import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { makeRunner, resolveLocalZgCli, resetZgCache } from '../src/index.ts';

const host = process.argv[2];
if (!host) throw new Error('Usage: node tools/verify-pi.mjs /path/to/pi-coding-agent');
const packageDir = path.resolve(import.meta.dirname, '..');
const sdk = await import(pathToFileURL(path.join(host, 'dist/index.js')).href);
const temp = await mkdtemp(path.join(os.tmpdir(), 'pi zg SDK '));
const cwd = path.join(temp, 'work space');
const agentDir = path.join(temp, 'agent');
const profile = path.join(temp, 'profile');
const engineHome = path.join(profile, '.zvec-grep');
await Promise.all([mkdir(cwd), mkdir(agentDir), mkdir(engineHome, {recursive: true})]);
const port = await new Promise((resolve, reject) => {
  const socket = createServer(); socket.once('error', reject);
  socket.listen(0, '127.0.0.1', () => { const value = socket.address().port; socket.close(() => resolve(value)); });
});
await writeFile(path.join(engineHome, 'config.json'), JSON.stringify({
  version: 1,
  defaults: {embedding: 'local/potion-code-16m-v2', modelCacheDir: path.join(os.homedir(), '.zvec-grep', 'models')},
  server: {host: '127.0.0.1', port},
}));
const entry = resolveLocalZgCli(path.join(packageDir, 'src'));
assert.ok(entry, 'packaged engine CLI missing');
const wrapper = path.join(temp, 'isolated engine.cjs');
// The engine's global configuration uses homedir(), independently of HOME.
// Only child processes see this profile; the live Pi and shared daemon do not.
await writeFile(wrapper, `process.env.USERPROFILE=${JSON.stringify(profile)}; process.env.HOME=${JSON.stringify(profile)}; process.argv=[process.execPath,${JSON.stringify(entry)},...process.argv.slice(2)]; import(${JSON.stringify(pathToFileURL(entry).href)});`);
const vars = {
  PI_ZG_BIN: wrapper,
  ZVEC_GREP_HOME: engineHome,
  ZVEC_GREP_SERVER_URL: `http://127.0.0.1:${port}/mcp`,
  ZVEC_GREP_EMBEDDING: 'local/potion-code-16m-v2',
  ZVEC_GREP_MODEL_CACHE: path.join(os.homedir(), '.zvec-grep', 'models'),
};
const saved = Object.fromEntries(Object.keys(vars).map(key => [key, process.env[key]]));
Object.assign(process.env, vars);
const cli = makeRunner({cwd, env: {...process.env}});
let session;
const notifications = [];
const checked = [];
try {
  await writeFile(path.join(cwd, 'theme loader.ts'), '// Restore the saved user theme at startup.\nexport function loadTheme() { return "dark"; }\n');
  await writeFile(path.join(cwd, 'notes.md'), '# Theme\nThe startup loader restores the saved color theme.\n');
  // Reproduce automatic startup with no daemon/index, then inspect health.
  assert.match((await cli.run(['server', 'status'])).stdout, /stopped/);
  await cli.startServer();
  let ready;
  for (let i = 0; i < 100; i++) {
    ready = await cli.run(['server', 'status']);
    if (/Server: ready/.test(ready.stdout)) break;
    await delay(100);
  }
  assert.match(ready.stdout, /Server: ready/);
  const pid = ready.stdout.match(/PID: (\d+)/)[1];
  checked.push('automatic detached daemon startup');
  const settingsManager = sdk.SettingsManager.inMemory({packages: [], defaultProjectTrust: 'always'});
  const resourceLoader = new sdk.DefaultResourceLoader({cwd, agentDir, settingsManager,
    additionalExtensionPaths: [path.join(packageDir, 'src/index.ts')],
    additionalSkillPaths: [path.join(packageDir, 'skills')], noPromptTemplates: true, noThemes: true});
  await resourceLoader.reload();
  assert.deepEqual(resourceLoader.getExtensions().errors, []);
  const created = await sdk.createAgentSession({cwd, agentDir, settingsManager, resourceLoader,
    sessionManager: sdk.SessionManager.inMemory(cwd), sessionStartEvent: false});
  session = created.session;
  const tool = session.agent.state.tools.find(t => t.name === 'zg');
  assert.ok(tool, 'zg tool inactive');
  assert.ok(resourceLoader.getSkills().skills.some(s => s.name === 'pi-zgrep-search'));
  // RG must work before an index exists.
  const execute = async params => {
    const result = await tool.execute('sdk-' + checked.length, params, new AbortController().signal);
    assert.ok(!result.isError, JSON.stringify(result));
    return result;
  };
  let result = await execute({query: 'loadTheme', mode: 'rg', glob: '*.ts', limit: 3});
  assert.ok(result.details.results.some(hit => hit.file === 'theme loader.ts'));
  checked.push('rg without an index, spaced paths and glob');
  for (const mode of ['hybrid', 'fts', 'vector']) {
    result = await execute({query: mode === 'fts' ? 'loadTheme' : 'restore saved user theme at startup', mode, type: 'ts', limit: 2, preview: 'short'});
    assert.ok(result.details.results.some(hit => hit.file === 'theme loader.ts'), JSON.stringify(result));
    assert.ok(result.details.results.length <= 2);
    checked.push(mode + ' with type filter and limit');
  }
  assert.match((await cli.run(['server', 'status'])).stdout, new RegExp('PID: ' + pid));
  checked.push('shared daemon reused');
  result = await execute({query: 'loadTheme', mode: 'fts', preview: 'none', glob: '*.ts', limit: 1});
  // Engine 0.2.2 uses one anchor line even for preview=none.
  assert.ok(result.details.results.every(hit => !hit.snippet?.includes('\n')), JSON.stringify(result));
  checked.push('preview none');
  await writeFile(path.join(cwd, 'theme loader.ts'), '// Restore the saved user theme at startup.\nexport function loadTheme() { return "light"; }\nexport function refreshedThemeMarker() { return "fresh"; }\n');
  result = await execute({query: 'refreshedThemeMarker', mode: 'fts', glob: '*.ts', refresh: 'wait', limit: 3});
  assert.ok(result.details.results?.some(hit => hit.file === 'theme loader.ts' && hit.snippet?.includes('refreshedThemeMarker')), JSON.stringify(result));
  checked.push('refresh wait after source edit');
  const runner = session.extensionRunner;
  runner.setUIContext({...runner.getUIContext(), notify: (text, type) => notifications.push({text, type}), setStatus: () => {}}, 'tui');
  for (const name of ['zg-index', 'zg-status', 'zg-server']) assert.ok(runner.getCommand(name));
  const ctx = () => runner.createCommandContext();
  const command = async (name, args) => runner.getCommand(name).handler(args, ctx());
  await command('zg-status', '');
  assert.match(notifications.at(-1).text, /index: ready/);
  assert.match(notifications.at(-1).text, /daemon: ready/);
  checked.push('/zg-status readiness and daemon health');
  await command('zg-index', `"${cwd}" --embedding local/potion-code-16m-v2 --mode auto --glob "*.ts" --rebuild`);
  assert.match(notifications.at(-1).text, /finished/);
  checked.push('/zg-index quoted root, valued flags and rebuild');
  await command('zg-server', 'status');
  assert.match(notifications.at(-1).text, /ready/);
  await command('zg-server', 'off');
  assert.match(notifications.at(-1).text, /done/);
  await command('zg-server', 'on');
  assert.match(notifications.at(-1).text, /done/);
  checked.push('/zg-server status/off/on');
  // Engine errors must be tool errors, not successful empty search results.
  result = await tool.execute('invalid-regex', {query: '(', mode: 'rg'}, new AbortController().signal);
  assert.equal(result.isError, true);
  checked.push('nonzero query errors surfaced');
  assert.ok(runner.getCommand('zg-index').getArgumentCompletions('--re').some(x => x.value === '--rebuild'));
  assert.ok(runner.getCommand('zg-server').getArgumentCompletions('st').some(x => x.value === 'status'));
  checked.push('command argument completion');
  console.log(JSON.stringify({piSdk: 'passed', platform: process.platform, node: process.version, checked, inferenceRequests: 0}));
} finally {
  session?.dispose();
  await cli.run(['server', 'off']).catch(() => {});
  resetZgCache();
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  // temp was generated under tmpdir; never delete user project/index files.
  assert.ok(path.resolve(temp).startsWith(path.resolve(os.tmpdir()) + path.sep));
  await rm(temp, {recursive: true, force: true, maxRetries: 10, retryDelay: 200});
}

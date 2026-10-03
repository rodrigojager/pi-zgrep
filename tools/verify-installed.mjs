import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {readFile} from 'node:fs/promises';

const host = process.argv[2];
if (!host) throw new Error('Usage: node tools/verify-installed.mjs /path/to/pi-coding-agent');
const sdk = await import(pathToFileURL(path.join(host, 'dist/index.js')).href);
const agentDir = path.join(os.homedir(), '.pi', 'agent');
const cwd = process.cwd();
const settingsManager = sdk.SettingsManager.create(cwd, agentDir);
const resourceLoader = new sdk.DefaultResourceLoader({cwd, agentDir, settingsManager});
await resourceLoader.reload();
assert.deepEqual(resourceLoader.getExtensions().errors, []);
const {session} = await sdk.createAgentSession({cwd, agentDir, settingsManager, resourceLoader,
  sessionManager: sdk.SessionManager.inMemory(cwd), sessionStartEvent: false});
try {
  const tools = session.getAllTools().map(t => t.name);
  assert.ok(tools.includes('zg'));
  assert.ok(!tools.includes('workspace_search') && !tools.includes('workspace_expand'));
  const skills = resourceLoader.getSkills().skills.filter(s => s.name === 'workspace-search');
  assert.equal(skills.length, 1, 'search skill must not be duplicated');
  const body = await readFile(skills[0].filePath, 'utf8');
  assert.ok(body.includes('pi-zgrep') && body.includes('mode: "hybrid"'));
  for (const name of ['ova-luna-review', 'ova-luna-implement']) {
    const profile = await readFile(path.join(agentDir, 'agents', name + '.md'), 'utf8');
    assert.match(profile, /tools: .*\bzg\b/);
    assert.match(profile, /extensions: zg-subagent/);
    assert.ok(!profile.includes('mcp__zvec_grep__zvec_grep_search'));
  }
  console.log(JSON.stringify({installed: true, tool: 'zg', oldToolsAbsent: true, searchSkillCount: skills.length, migratedProfiles: 2, inferenceRequests: 0}));
} finally { session.dispose(); }

import { spawnSync } from 'node:child_process';
const result = spawnSync(process.execPath, ['--test', 'test/e2e.test.ts'], {
  env: {...process.env, ZG_TEST_E2E: '1'}, stdio: 'inherit', windowsHide: true,
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;

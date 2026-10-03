# Windows compatibility and fork changes

Baseline: the complete `carvalab/pi-zgrep` 0.3.0 source tree and Git history. No upstream search feature is removed. The search engine remains `@zvec/zvec-grep` 0.2.2; this fork changes the Pi integration, not retrieval algorithms.

## Preserved behavior

- One `zg` tool with hybrid, fts/BM25, vector and rg routes.
- Query, limit, glob, type, preview and refresh parameters; rg bypasses indexing.
- `/zg-index`, `/zg-status`, `/zg-server on|off|status`, argument completion and engine-option passthrough.
- Background session warmup, automatic index creation, concurrent build/install deduplication, failed-build memoization and daemon reuse.
- `PI_ZG_BIN`, `PI_ZG_AUTO_INSTALL`, `PI_ZG_GUIDANCE` and `PI_ZG_SERVER`, including upstream's nonempty-value opt-out semantics.
- Packaged-engine resolution before PATH, global npm installation with `--ignore-scripts` retry and bun fallback.
- Raw output fallback when the engine's format is unrecognized, upstream fixtures and all upstream documentation.

## Corrections

1. All launch paths use `cross-spawn` for Windows executable/shim resolution and escaping. Packaged `.js`, `.mjs` and `.cjs` entries run through Node, including automatic daemon startup. Background Windows consoles are hidden.
2. Indexed and rg result parsers preserve drive letters, backslashes, Unicode and spaces in filenames. Ranking attributes are separated from paths instead of swallowing path components.
3. Index arguments support quoted roots, quoted values, valued flags and future engine options without evaluating shell syntax. Invalid input clears the indexing status.
4. Nonzero queries are explicit Pi tool errors. Streaming index errors reach progress/failure output instead of disappearing on stderr.
5. Query cancellation uses the current tool call's signal, not the first call's cached runner. Foreground build signals and progress remain current when a shared ensure-chain is reused.
6. Tests no longer rely on `/bin/true` or shell scripts. Real-engine fixture searches use direct transport so they do not attach test indexes to the user's shared daemon.
7. The shared English `workspace-search` skill now documents `zg`, all four routes, filters, targeted native reads and the actual command surface. The engine's `preview=none` can still return one anchor line; the fork preserves that behavior.

## Verification

Run from the repository:

```text
npm ci --ignore-scripts
npm run lint
npm run format:check
npm run typecheck
npm test
npm run test:e2e
node tools/verify-pi.mjs /absolute/path/to/pi-coding-agent
```

The SDK smoke uses an isolated workspace, profile, daemon home and dynamically selected port. It checks automatic daemon startup, reuse, rg before indexing, all indexed routes, type/glob/limit/preview, refresh after editing, commands, quoted roots and valued index flags, server on/off/status, query errors and command completions. It sends no model-inference requests and stops only its own daemon.

Local validation target: Windows x64, Node 26.1.0, Pi 1.0.0, engine 0.2.2. CI also runs unit, lint, formatting and type checks on Windows and Linux with Node 22/24/26. Local Windows validation is not a claim that every platform/version combination has already executed successfully.

The fork keeps the upstream release workflow but gates npm publication to the upstream repository. Custom releases are published on GitHub; `private: true` prevents accidental npm publication.

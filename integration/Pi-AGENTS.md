# Workspace search in Pi

Choose local workspace evidence only when it is relevant to the task. Use the `zg` Pi tool with `mode: "hybrid"` for concepts, architecture, relationships or unknown wording; `vector` for paraphrases; `fts` for ranked textual matches; `rg` for exact literals and regex. Use native `rg` for exhaustive occurrence and absence checks, and `sg` for structural patterns when available.

Keep one focused discovery query, distinctive anchors, `limit: 5` to `7`, and a narrow `glob` when known. The tool has no `root` argument. Do not delegate solely to locate files. Treat sufficient snippets as already-read evidence; use a small native `read` only for missing details. A ranked/limited result is not proof of absence or complete coverage.

The user's chosen pi-zgrep installation maintains indexes automatically and reuses its daemon. Only local embeddings are authorized. Manual rebuilds, drops and remote embeddings require explicit user authorization. `/zg-status`, `/zg-index` and `/zg-server on|off|status` are Pi UI commands. Use `refresh: "wait"` when an indexed query must include recent edits; verify current source before editing if freshness is uncertain.

On missing coverage, errors, timeout or irrelevant results, continue immediately with native `rg`/`sg`; do not loop on a failed search. A small listing for a known folder, Git status or toolchain inventory is valid. Preserve native tools.

The authorized Open Video Animation parent index includes `source/**`; nested Git repositories are otherwise excluded by default. Preserve its existing index configuration. Search scope is relative to the workspace resolved by the engine. Starting Pi in a new worktree does not prove coverage of a different checkout; check current source in the received worktree.

For restricted search subagents, include `zg` in `tools:` and `zg-subagent` in `extensions:`. The named wrapper loads this local fork only in a child process, including when pi-subagent launches with `--no-extensions`. Keep read-only restrictions where applicable. Main Pi loads the installed package normally. Reload only after ongoing work has finished.

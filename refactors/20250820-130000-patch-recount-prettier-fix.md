# Refactor: add --recount to patch; fix Prettier in CLI

When: 2025-08-20T13:00:00Z
Why: Patches can fail when hunk-header line numbers drift. `git apply --recount` recalculates them. Also fixed a Prettier formatting error in CLI.
What changed:

- src/stan/patch.ts: include `--recount` in all git apply strategies (both strip levels; check and apply modes).
- src/cli/stan/index.ts: split long type cast across lines to satisfy Prettier.
  Tests/Lint:
- Tests: existing patch tests are unaffected (spawn is mocked).
- Lint: Prettier error resolved; TSDoc warning remains informational.
  Links:
- git-apply docs for `--recount`: https://git-scm.com/docs/git-apply
  Next:
- If patch failures persist, consider also adding `-C1` for extra tolerance.

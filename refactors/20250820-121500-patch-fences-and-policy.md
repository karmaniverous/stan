# Refactor: patch fence unwrapping + prompt patch policy

When: 2025-08-20T12:15:00Z
Why: Patches touching markdown files broke when we stripped all ``` lines; also need a standard for emitting per‑file patches.
What changed:

- src/stan/patch.ts: unwrap only outer code fences/BEGIN/END banners; preserve interior backticks; keep EOL/zero‑width cleanup and debug stderr on.
- stan.system.md: require a unified diff + base64 patch after each full file listing, including for the refactor log file.
  Tests/Lint:
- Existing tests pass; no new warnings.
  Next:
- Consider exposing last failing git stderr summary in non‑debug mode when all strategies fail.

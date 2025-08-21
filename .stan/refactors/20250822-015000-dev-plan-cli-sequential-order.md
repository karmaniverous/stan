# Refactor: dev plan — note CLI sequential-order issue (low priority)

When: 2025-08-22T01:50:00Z (UTC)
Why: Track a low-priority issue where `stan run -s -q` does not run scripts in config order.

What changed:
- .stan/system/stan.todo.md: added a housekeeping bullet to reproduce, test, and fix sequential config-order execution for `-s -q` (especially when `-s` is present with no keys).

Tests/Lint:
- No code changes in this turn; no test/lint impact.

Next:
- Reproduce with targeted CLI tests.
- If confirmed, adjust deriveRunInvocation/runner to preserve config order under `-s -q` and update tests accordingly.

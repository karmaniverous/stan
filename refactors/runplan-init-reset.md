# Refactor: multiline plan + init reflow

When: 2025-08-19T15:30:00Z
Why: Improve UX: 1) Make the stan run plan summary readable with newlines. 2) Re-run interactive init when config exists, using current config as defaults, and confirm diff reset.
What changed:

- src/stan/run.ts: renderRunPlan now returns a multi-line, labeled block.
- src/cli/stan/init.ts: interactive flow runs even with existing config; defaults prefilled; added “Reset diff snapshot now?” confirm; snapshot honored.
- stan.project.md: logging guideline updated to multi-line plan.
  Tests/Lint:
- Existing tests do not assert the plan line; no breakage expected. Init force-path still writes snapshot (tests pass).
- Lint/typecheck unchanged.
  Links:
- Artifact reference: ctx/test.txt shows prior single-line plan; this change improves readability.
  Next:
- Optional: Add a smoke test asserting the presence of multi-line plan headers.

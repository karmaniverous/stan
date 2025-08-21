# Refactor: confirm defaults and prioritize P0 patch handling
When: 2025-08-21T21:45:00Z (UTC)
Why: User confirmed large-text thresholds, preflight UX, version metadata format, and P0 prioritization. The dev plan should memorialize these decisions to avoid context loss.
What changed:
- .stan/system/stan.todo.md:
  • Added “Plan management policy”
  • Clarified P1 preflight UX (interactive only if TTY; suggest command otherwise)
  • Clarified P2 version metadata content (version only)
  • Specified P3 classifier thresholds (size > 1 MB; LOC > 3000)
  • Added “Defaults (confirmed)” section and kept P0 first in milestones
Tests/Lint:
- Documentation-only change; no code modified
Next:
- Begin P0: implement parse/resolver/jsdiff/(dmp)/pipeline/reporter/sandbox and FEEDBACK clipboard bundle with tests

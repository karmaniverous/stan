# Refactor: prioritize robust patch handling and dev plan focus
When: 2025-08-21T21:20:00Z (UTC)
Why: Preserve context with a living development plan and accelerate delivery by prioritizing the clipboard-based patch feedback loop. Clarify in the system prompt that the primary job is to finish the swing on the dev plan.
What changed:
- .stan/system/stan.todo.md:
  • Added ALIASES and plan-management policy
  • Prioritized P0 robust patch handling; detailed modules, FEEDBACK v1, acceptance criteria, and tests
  • Sequenced milestones with P0 first
- .stan/system/stan.system.md:
  • Added “development plan” alias
  • Under Default Task, made “finish the dev plan” the primary objective before Step 0
Tests/Lint:
- Tests: documentation-only changes (no code executed)
- Lint: unchanged
Next:
- Implement P0: parse/resolver/jsdiff/(dmp)/pipeline/reporter/sandbox; add FEEDBACK clipboard bundle; add tests

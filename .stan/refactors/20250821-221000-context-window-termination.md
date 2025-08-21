# Refactor: context window exhaustion termination rule
When: 2025-08-21T22:10:00Z (UTC)
Why: Ensure STAN halts when the original full archive falls out of the context window, avoiding risky partial-context decisions. In-repo state allows safe resumption in a fresh chat.
What changed:
- .stan/system/stan.system.md: added “Context window exhaustion (termination rule)” under Operating Model.
- .stan/system/stan.todo.md: plan policy now notes the termination rule to prevent context loss across threads.
Tests/Lint:
- Documentation-only change; no code modified.
Next:
- Continue P0 work on robust patch handling (FEEDBACK loop), then wire P1 preflight and P2 version metadata.

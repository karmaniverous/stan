# Refactor: docs for archive flags and combine simplification

When: 2025-08-19T21:25:00Z
Why: Align user-facing documentation with new behavior: archives are opt-in (-a), combine implies archive and conflicts keep, no special “combined” artifacts, and outputs live inside archives under -c.
What changed:

- README.md: updated options, examples, artifacts matrix; removed combined artifacts; config sample no longer shows combinedFileName.
- stan.project.md: removed “archive job”, added -a/-c/-k semantics, artifacts rules, config shape updated.
- stan.project.template.md: synced with project docs.
  Tests/Lint:
- Docs-only; no code failures. Type/ESLint unaffected.
  Next:
- If desired, update help examples string in code to reflect -a/-c usage patterns.

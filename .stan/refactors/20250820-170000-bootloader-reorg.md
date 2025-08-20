# Refactor: stanPath reorg + bootloader

When: 2025-08-20T17:00:00Z
Why: Reduce prompt redundancy with a bootloader; formalize a stable stanPath layout; centralize directory mapping; move outputs to stan/output and diffs to stan/diff.
What changed:

- Config: outputPath -> stanPath; new src/stan/paths.ts (global mapping).
- Archive/Diff/Run/Snap/Runner: switched to stanPath; outputs in stan/output; diffs in stan/diff.
- Init: scaffold stan/system; copy stan.system.md, stan.project.template.md, stan.bootloader.md; update .gitignore.
- Rollup: ship bootloader + system files from stan/system into dist; dev build to stan/dist.
- Docs: README bootloader section; stan/system/stan.system.md updated with CRITICAL directive.
  Tests/Lint:
- Code compiles under new types; docs & config updated. Tests will need path updates to stan/output in a follow-up.
  Next:
- Update unit tests paths (stan/output) and plan header expectations; migrate any references to outputPath.

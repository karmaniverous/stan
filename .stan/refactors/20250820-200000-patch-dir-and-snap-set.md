# Refactor: patch workspace, archive inclusion, and snap set

When: 2025-08-20T20:00:00Z
Why: Centralize patches in .stan/patch, include them in all archives/diffs, clear on archive; remove defaultPatchFile; stage patches by default; enhance snap info and add set <index>. Add SYSTEM/PROJECT guidance for patch failures.
What changed:

- src/stan/paths.ts: add patchRel/patchAbs.
- src/stan/patch.ts: write to <stanPath>/patch/.patch; diagnostics to <stanPath>/patch/.debug; apply with --index by default; no defaultPatchFile.
- src/stan/archive.ts: always include <stanPath>/patch in archive.tar.
- src/stan/diff.ts: always include <stanPath>/patch in archive.diff.tar; include it also when “no changes”.
- src/stan/run.ts: clear <stanPath>/patch after archiving; TSDoc escape fix.
- src/cli/stan/init.ts: add <stanPath>/patch to .gitignore; remove defaultPatchFile.
- src/stan/config.ts: remove defaultPatchFile; TSDoc fix.
- src/stan/snap.ts: show indices in info; add snap set <index>; Prettier fix.
- Tests: updated snap.test (set/wait) and archive behavior to include patch dir.
- .stan/system/stan.system.md: SYSTEM guidance for patch failure analysis.
- stan.project.md: PROJECT guidance for processing improvements.
  Tests/Lint:
- Lint: import order & Prettier fixed; tsdoc “>” warnings resolved where updated.
- Tests: updated suites pass locally after timing wait for snap state.
  Links:
- Patch policy: .stan/patch is always included in archives; cleared on archive generation.

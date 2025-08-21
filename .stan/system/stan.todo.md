# STAN Development Plan (tracked in .stan/system/stan.todo.md)

When updated: 2025-08-22 (UTC)

ALIASES

- “development plan” / “dev plan” / “implementation plan” / “todo list” → <stanPath>/system/stan.todo.md

Purpose

- Single source of truth for the current development plan across chat threads.
- The assistant updates this document:
  1. Whenever a development plan is approved, and
  2. AFTER a new project state is uploaded showing plan elements completed at high quality
     (tests written and passing, no errors, features code-complete).

Authoritative sources considered for each update

- The latest project archive(s) and deterministic outputs:
  • .stan/output/archive.tar (and archive.diff.tar if present)
  • test.txt, lint.txt, typecheck.txt, build.txt (inside or alongside archives)
- Current requirements in .stan/system/stan.system.md and .stan/system/stan.project.md.
- Any prior plan entries in this file.

Plan management policy (to avoid context loss)

- This file is the canonical plan. The assistant must keep it current and small enough to remain readable.
- Plan updates are delivered as patches to this file (Full Listing + Patch) with a matching refactor note under .stan/refactors/.
- The plan may summarize or link to prior decisions; it should not re-litigate settled requirements unless requirements changed.
- Termination rule (context window exhaustion): If a full archive was uploaded earlier in this chat and is no longer present in the current context window, consider the thread exhausted and terminate the chat. Resume in a new chat by attaching the latest archives; STAN’s in‑repo state under <stanPath>/system enables safe resumption.

Baseline (current requirements override older plan)

- Requirements in .stan/system/stan.system.md are authoritative.
- Path heuristics: no fuzzy/basename matching; deterministic patch application only.
- Patch format: LF; a/ b/ prefixes; ≥3 lines context; avoid binary; no base64.
- Design-first lifecycle: iterate requirements before code.

Implementation status (synced with current snapshot)
Done

- Bootloader: robust stanPath and repo-root inference; loads .stan/system/stan.system.md from archives.
- CLI/run:
  • Selection model (-s, -x, -q), -a/--archive, -c/--combine, -k/--keep
  • Always-on diff tar when --archive is used
  • Combine mode includes outputs; regular archive includes <stanPath>/patch and handles output dir inclusion
  • Plan header printed for runs
- Snap:
  • write/replace diff snapshot; history with undo/redo/set/info
  • optional stash -s; copies current archives into diff/archives; bounded retention
- Patch (foundation):
  • Clipboard default; -f/--file and [input]; -c/--check
  • Unified-diff cleaning (outer fence/banner unwrap; fenced/raw extraction; LF; zero‑width strip; ensure final newline)
  • Multi-strategy git apply with --recount across -p1/-p0; staged by default; diagnostics under <stanPath>/patch/.debug/
  • Moves new \*.rej to <stanPath>/refactors/patch-rejects-<ts>/
  • Canonical patch workspace at <stanPath>/patch; always included in archives; cleared on archive
- Patch (P0 completed):
  • jsdiff fallback engine integrated (diff v8 API); whitespace/EOL‑tolerant apply; preserves CRLF; unit test stabilized and passing
  • Reporter polish: attempts.json carries both git attempt captures and jsdiff results (okFiles, failedFiles, sandboxRoot); on total failure (non‑debug), prints a concise last‑error snippet from git apply
  • FEEDBACK envelope: includes a lastErrorSnippet (concise stderr excerpt) for faster triage
  • Sandbox retention: after --check runs, prune <stanPath>/patch/.sandbox to keep only the latest few (default 5)
  • Parse/resolver (initial): parse unified diff, derive strip candidates (p1 vs p0), and include basic per-file diagnostics in FEEDBACK (missing a/b prefixes, may require --recount)
  • Resolver (FS-backed): check path existence under repo and include "path not found" and exists: yes/no in diagnostics
- FS filtering:
  • Includes/excludes with glob support; .gitignore respected; deterministic deny/allow rules
- Build/docs packaging:
  • Docs copied to dist (stan.system.md, stan.project.template.md, stan.bootloader.md)
- Version CLI:
  • stan -v/--version prints STAN version, Node version, repo root, stanPath, doc baseline status (inSync), last docs version (if present)
  • Init writes <stanPath>/system/.docs.meta.json with { "version": "<package.version>" } so preflight/-v can report “docs last installed”
- P1 Preflight wiring:
  • preflightDocsAndVersion is called at run start (non‑blocking); unit test added
- Type/lint cleanup:
  • Fixed ESLint no-empty by adding debug-only logging in src/stan/run.ts preflight catch.
  • Resolved TypeScript generics/typing in src/stan/preflight.run.test.ts so typecheck/docs pass.
  • FEEDBACK fallback file: envelope also written to <stanPath>/patch/.debug/feedback.txt for environments without clipboard access
- Archive classifier:
  • Binary files excluded from archive using istextorbinary
  • Large text flagged (size > 1 MB or LOC > 3000); warnings emitted to <stanPath>/output/archive.warnings.txt and included in archives
  • Unit tests for classifier service and archive integration (tar mocked)

Partially done / scaffolding present
• (none)

Open/remaining (prioritized)

Housekeeping

- Resolve lint warnings (tsdoc escape “>”; remove unused eslint-disable in version.ts)
- Knip: src/stan/preflight.ts “unused” will clear when wired; istextorbinary used by classifier
- Low priority: “stan run -s -q” does not run scripts in config order — reproduce, add/adjust tests for sequential config-order execution with -s (no keys), and fix derive/runner if required.

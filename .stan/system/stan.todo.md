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
- Patch (P0 progress this turn):
  • jsdiff fallback engine integrated (diff v8 API); whitespace/EOL‑tolerant apply; preserves CRLF; unit test stabilized and passing
  • Reporter polish: attempts.json carries both git attempt captures and jsdiff results (okFiles, failedFiles, sandboxRoot); on total failure (non‑debug), prints a concise last‑error snippet from git apply
  • Sandbox retention: after --check runs, prune <stanPath>/patch/.sandbox to keep only the latest few (default 5)
  • Test-only Prettier suppression for jsdiff test to avoid line‑ending churn in CI
- FS filtering:
  • Includes/excludes with glob support; .gitignore respected; deterministic deny/allow rules
- Build/docs packaging:
  • Docs copied to dist (stan.system.md, stan.project.template.md, stan.bootloader.md)
- Version CLI:
  • stan -v/--version prints STAN version, Node version, repo root, stanPath, doc baseline status (inSync), last docs version (if present)
- P1 Preflight wiring:
  • preflightDocsAndVersion is called at run start (non‑blocking); unit test added
- Type/lint cleanup:
  • Fixed ESLint no-empty by adding debug-only logging in src/stan/run.ts preflight catch.
  • Resolved TypeScript generics/typing in src/stan/preflight.run.test.ts so typecheck/docs pass.

Partially done / scaffolding present

- Version info reads .stan/system/.docs.meta.json if present, but init does not write it yet.

Open/remaining (prioritized)
P0 — Robust patch handling (clipboard-driven FEEDBACK loop)

- Goals
  • Make patches “just work,” or when they don’t, return a compact, self-identifying FEEDBACK bundle copied to clipboard so the user can paste it back and get an improved diff without extra instructions.
  • This accelerates all other workstreams (e.g., preflight, classifier) by increasing patch iteration throughput.
- Scope (modules and responsibilities)
  • intake/clean: Unwrap only outer fences/banners; strip zero-width; normalize LF; ensure final newline (exists).
  • intake/parse: Parse unified diff into a normalized structure; identify candidate strip levels; per-file hunks (TODO).
  • plan/resolver: Deterministic mapping (p1/p0; no fuzzy/basename by default); classify causes (path mismatch, context drift, EOL/whitespace) (TODO).
  • engines/git-apply: Attempt matrix across p1/p0 with 3-way/ignore-whitespace/nowarn/recount; collect .rej and relocate; staged by default (exists; summarized).
  • engines/jsdiff: [DONE] Whitespace/EOL-tolerant per-file patch as a second engine; preserves original EOL; deterministic failure when hunks cannot be placed.
  • engines/dmp: Last-resort fuzzy application with conservative thresholds; flag fuzzy files clearly; unstaged (optional) (TODO).
  • runner/pipeline: Orchestrate clean→parse→git→jsdiff→(dmp); honor --check; sandbox outputs under <stanPath>/patch/.sandbox/<ts>/; console status summary (exists; extended).
  • reporter: [PARTIAL] .debug/cleaned.patch + attempts captures; attempts.json now includes git+jsdiff; print brief last‑error snippet (non‑debug). Next: include a concise stderr summary in the FEEDBACK envelope; consider bounded sandbox retention by size/time.
  • io/workspace: Ensure patch/.debug/, patch/.sandbox/<ts>/, and refactors/patch-rejects-<ts>/ exist; confine artifacts (exists). [DONE] Prune sandboxes to last N (default 5) after --check.
- FEEDBACK Bundle v1 (clipboard)
  • Envelope markers: BEGIN_STAN_PATCH_FEEDBACK v1 … END STAN_PATCH_FEEDBACK
  • Sections: repo, status (enginesTried/stripTried), summary (changed/failed/fuzzy), diagnostics (optional), patch.cleanedHead, attempts (git/jsdiff/dmp).
  • Next: include last‑error snippet in FEEDBACK for faster triage.
- Acceptance criteria (updated)
  • A deliberately failing patch produces a FEEDBACK bundle on the clipboard; console points to .debug; new .rej moved to refactors/ (exists)
  • A whitespace/EOL-drift patch applies via jsdiff engine (when git apply fails) preserving original EOL per file (done)
  • With --check, no repo files are changed and a .sandbox/<ts>/ is written; older sandboxes are pruned (done)
  • No basename/fuzzy path matching in default mode; path/strip fixes regenerated in next diff (exists)
  • Tests cover engines, pipeline orchestration, reporter, and clipboard write (partially done; jsdiff path covered)

P2 — Version awareness metadata on init

- Write <stanPath>/system/.docs.meta.json with { "version": "<package.version>" } (no hashes).
- -v prints “docs last installed: <version>”; preflight uses it to detect post-upgrade nudges

P3 — Archive classifier (binary/large)

- Exclude binaries explicitly via istextorbinary; track concise top-N console summaries; list full details in <stanPath>/output/archive.warnings.txt
- Detect large text (defaults: size > 1 MB or LOC > 3000; configurable constants)
- Include archive.warnings.txt in archives; under -c, still pack inside
- Tests: classifier unit; archive integration (presence in tar); thresholds

Housekeeping

- Resolve lint warnings (tsdoc escape “>”; remove unused eslint-disable in version.ts)
- Knip: src/stan/preflight.ts “unused” will clear when wired; istextorbinary used by classifier

Milestones (ordered)

0. P0 Robust patch handling (clipboard FEEDBACK loop)

- Implement parse/resolver (per-file hunks) and optional DMP fallback
- Reporter: FEEDBACK envelope last‑error summary and overall polish
- Tests per P0 above

1. P2 Version meta write + -v polish
2. P3 Archive classifier

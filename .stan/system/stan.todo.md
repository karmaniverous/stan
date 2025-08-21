# STAN Development Plan (tracked in .stan/system/stan.todo.md)

When updated: 2025-08-21 (UTC)

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
- Patch (foundation only):
  • Clipboard default; -f/--file and [input]; -c/--check
  • Unified-diff cleaning (outer fence/banner unwrap; fenced/raw extraction; LF; zero-width strip; ensure final newline)
  • Multi-strategy git apply with --recount across -p1/-p0; staged by default; diagnostics under <stanPath>/patch/.debug/
  • Moves new \*.rej to <stanPath>/refactors/patch-rejects-<ts>/
  • Canonical patch workspace at <stanPath>/patch; always included in archives; cleared after archiving
- FS filtering:
  • Includes/excludes with glob support; .gitignore respected; deterministic deny/allow rules
- Build/docs packaging:
  • Docs copied to dist (stan.system.md, stan.project.template.md, stan.bootloader.md)
- Version CLI:
  • stan -v/--version prints STAN version, Node version, repo root, stanPath, doc baseline status (inSync), last docs version (if present)

Partially done / scaffolding present

- Preflight (docs/version) helper exists (src/stan/preflight.ts) but is not invoked at start of stan run.
- Version info reads .stan/system/.docs.meta.json if present, but init does not write it yet.

Open/remaining (prioritized)
P0 — Robust patch handling (clipboard-driven feedback loop)

- Goals
  • Make patches “just work,” or when they don’t, return a compact, self-identifying FEEDBACK bundle copied to clipboard so the user can paste it back and get an improved diff without extra instructions.
  • This accelerates all other workstreams (e.g., preflight, classifier) by increasing patch iteration throughput.
- Scope (modules and responsibilities)
  • intake/clean: Unwrap only outer fences/banners; strip zero-width; normalize LF; ensure final newline (exists).
  • intake/parse: Parse unified diff into a normalized structure; identify candidate strip levels; per-file hunks (add).
  • plan/resolver: Deterministic mapping (p1/p0; no fuzzy/basename by default); classify causes (path mismatch, context drift, EOL/whitespace) (add).
  • engines/git-apply: Attempt matrix across p1/p0 with 3-way/ignore-whitespace/nowarn/recount; collect .rej and relocate; staged by default (exists; refine summary/labels).
  • engines/jsdiff: Whitespace-tolerant per-file patch as a second engine; preserve EOL flavor; deterministic failure when hunks cannot be placed (add).
  • engines/dmp: Last-resort fuzzy application with conservative thresholds; flag fuzzy files clearly; unstaged (optional for P0, good to add as P0.5) (add).
  • runner/pipeline: Orchestrate clean→parse→git→jsdiff→(dmp); honor --check; sandbox outputs under <stanPath>/patch/.sandbox/<ts>/; console status summary (add/enhance).
  • reporter: Emit .debug/cleaned.patch, attempts.json, per-attempt logs; summarize engines tried; move .rej; build FEEDBACK bundle and copy to clipboard on failure/partial (add).
  • io/workspace: Ensure patch/.debug/, patch/.sandbox/<ts>/, and refactors/patch-rejects-<ts>/ exist; confine artifacts (exists; extend sandbox).
  • policy/config: Safe defaults: whitespace tolerance on; engines enabled; disallow binary; size/time guards; (optional) future patch: {} config section (add).
- FEEDBACK Bundle v1 (clipboard)
  • Envelope markers: BEGIN_STAN_PATCH_FEEDBACK v1 … END_STAN_PATCH_FEEDBACK
  • Sections:
  - repo: { name?: string, stanPath?: string }
  - status: { overall: failed|partial|fuzzy|check, enginesTried: [git,jsdiff,dmp], stripTried: [p1,p0] }
  - summary: { changed: string[], failed: string[], fuzzy?: string[] }
  - diagnostics: [{ file, causes: string[], details: string[] }, …] (only for failures/partials)
  - patch: { cleanedHead: string } (first few KB)
  - attempts: { git: { tried, rejects, lastCode }, jsdiff: { okFiles, failedFiles }, dmp: { okFiles } }
    • No embedded instructions; stan.system.md defines the assistant’s behavior when this packet is pasted.
- CLI surface (reiterated)
  • patch sources: clipboard (default), -f/--file <path>, [input] argument
  • --check: end-to-end dry-run; write to <stanPath>/patch/.sandbox/<ts>/; no repo file changes
  • Staging policy: default apply staged (--index); do not stage for --check
- Acceptance criteria
  • A deliberately failing patch produces a FEEDBACK bundle on the clipboard; console points to .debug; new .rej moved to refactors/
  • A whitespace/EOL-drift patch applies via jsdiff engine (when git apply fails) preserving original EOL per file
  • With --check, no repo files are changed and a .sandbox/<ts>/ is written
  • No basename/fuzzy path matching in default mode; path/strip fixes are regenerated in the next diff
  • Tests cover engines, pipeline orchestration, reporter, and clipboard write (mocks)
- Tests (incremental)
  • Unit: detect/clean; parse; resolver; jsdiff apply; dmp (if included); feedback builder; sandbox writer; clipboard integration (mock clipboardy)
  • Integration: failing patch → FEEDBACK; whitespace-drift patch → success via jsdiff; --check creates sandbox; \*.rej moved

P1 — Preflight integration on stan run

- Compare local stan.system.md to packaged baseline; warn on drift; suggest moving edits to stan.project.md; optional revert to baseline (interactive only if TTY; otherwise print a suggested command).
- At run start: call preflightDocsAndVersion()
- Acceptance: visible warning on drift; nudge printed when package version advanced and docs changed

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

Milestones (ordered) 0) P0 Robust patch handling (clipboard FEEDBACK loop)

- Implement parse/resolver/jsdiff/(dmp)/pipeline/reporter/sandbox; add feedback builder and clipboard write
- Tests per P0 above

1. P1 Preflight wiring
2. P2 Version meta write + -v polish
3. P3 Archive classifier

Defaults (confirmed)

- Large text thresholds: size > 1 MB; LOC > 3000
- Binary exclusion: exclude by default with istextorbinary detection
- Preflight revert UX: interactive only if TTY; otherwise print suggested command
- Version metadata content: <stanPath>/system/.docs.meta.json holds only { version }

Response Format for plan updates

- Any change to this plan must be delivered as a plain unified diff patch to .stan/system/stan.todo.md in the assistant’s reply.
- Follow system Response Format:
  • Include both a Full Listing and a Patch block for every created/updated/deleted file in the response.
  • Respect the fence +1 rule (outer fence length > max backticks found inside).
  • Also add a brief refactor log entry under .stan/refactors/YYYYMMDD-HHMMSS-<kebab>.md summarizing “Why/What/Tests/Lint/Next”.

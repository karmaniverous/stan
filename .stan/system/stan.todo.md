# STAN Development Plan

When updated: 2025-09-26 (UTC)

Next up (priority order)

1. Patch-failure envelopes (downstream vs STAN repo)
   - Downstream (diff): one-liner per failed file with a blank line between items; request full, post‑patch listing.
   - Downstream (file ops): quote the ops block and request unified‑diff patches; ensure blank-line separation when multiple outputs occur.
   - STAN repo (diff): identify the failed file, then emit diagnostics envelope:
     ```
     START PATCH DIAGNOSTICS
     <verbatim git stderr; if absent and jsdiff ran: lines “jsdiff: <path>: <reason>">
     END PATCH DIAGNOSTICS
     ```
     No “Print a full…” line here.
   - STAN repo (file ops): “The File Ops patch failed.” + diagnostics envelope; no unified‑diff re‑request line.
   - No persistence of diagnostics (clipboard/stdout only).

- Formatter + wiring (reusable; future DMP)
  - Implement a central formatter that takes:
    - context: downstream vs STAN repo,
    - kind: diff | file-ops | (future) dmp,
    - diagnostics: { stderr?: string; jsReasons?: Array<{ path, reason }> }.
  - Replace current failure output assembly in patch service with the new formatter.
  - Ensure single diagnostics block per failure; preserve header-derived paths for labeling failed diffs; keep existing path fallback logic.

- Tests
  - Downstream spacing: multiple failed diff files yield one-liners separated by blank lines.
  - STAN repo diagnostics envelope for diff (git stderr; jsdiff-only) and file ops.
  - Ensure no .debug/.rej persistence.
  - Maintain existing path derivation behavior when jsdiff reports “(patch)” (prefer header-derived paths).

- Assistant guidance (project prompt only)
  - Add/maintain a concise section describing diagnostics consumption, classification (generator vs handler vs drift), and offering choices:
    - Fix now (small + safe),
    - Log a task (defer),
    - Request listings (diff) or unified diffs (file ops), as appropriate.
  - No user-facing docs updates yet; defer until behavior stabilizes.

- DMP readiness (follow-on)
  - When DMP apply lands, feed its stderr/summary through the same formatter and share the envelopes with diff/file ops behavior.

- Codebase reduction: identify and eliminate dead or duplicated code where safe; prefer reuse of shared helpers.

- Adopt explicit dev‑mode diagnostics triage in project prompt: analyze → ask → apply or listings; gate patch emission on explicit approval.

Unpersisted tasks

- Extend formatter to incorporate future DMP rung (produce a DMP attempt line + reasons alongside git/jsdiff).
- Minor polish:
  - Audit other diagnostics call-sites for reuse of the shared helpers.
  - Consider a brief docs note in README about full vs diff archive contents (patch workspace policy).

Completed (recent)

- Validated diffs for ops‑only acceptance (no full listings):
  - Reissued correct unified diffs for new test and doc updates.

- Lint clean-up:
  - Removed dead constant-condition block in src/stan/patch/service.ts (no-constant-condition).

- Patch workspace policy: exclude from ALL archives (full and diff).
  - Code: filterFiles and tar filter updated; bootstrap archiver excludes .stan/patch.
  - Tests: combine archive behavior updated (no patch dir); fixed regex escaping in attempts[] integration test.
  - Docs: project prompt updated to reflect exclusion in all archives.

- Extracted and deduplicated diagnostics helpers:
  - Added src/stan/patch/diag/util.ts with AttemptLabel, firstStderrLine, and renderAttemptSummary.
  - Refactored src/stan/patch/format.ts to use the shared helpers; removed local logic duplication.

- Added integration test to assert attempts[] summary order appears for git apply failures across p1→p0:
  - src/stan/patch/service.attempts.integration.test.ts

- Patch failure output alignment (tests):
  - Downstream (diff): one-liners now end with "was invalid." (no trailing listing request text in-line). Multiple failures remain blank-line separated. Tests assert for "invalid.\n\nThe unified diff..." spacing.
  - STAN (file ops): parse-diagnostics lines normalized to "file-ops …" to match diagnostics-envelope expectations in tests.

- Test alignment:
  - Updated service.failure-prompt-path test to expect the new downstream diff one-liner ending with "was invalid." (no inline listing request).
- Patch failure prompt path fix:
  - Clipboard/stdout prompt now uses the actual file path instead of "(patch)" when jsdiff reports a generic parse error. The service falls back to header-derived paths when jsdiff does not provide concrete file names.
- File Ops payload alignment:
  - Updated parser/validator/service to accept an unfenced “### File Ops” block (lines after heading up to the next heading); removed fence handling.
  - Adjusted tests accordingly; clarified docs to remove “fenced” wording.

- Persist raw patch for manual reprocessing:
  - Write RAW input to .stan/patch/.patch (apply still uses the cleaned text in memory).
- Project doc clean‑up: removed obsolete “stan.dist/” reference; clarified RAW patch persistence.
- Attempts integration test: fixed regex escaping to assert attempt lines reliably.

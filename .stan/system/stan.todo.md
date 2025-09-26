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

2. Formatter + wiring (reusable; future DMP)
   - Implement a central formatter that takes:
     - context: downstream vs STAN repo,
     - kind: diff | file-ops | (future) dmp,
     - diagnostics: { stderr?: string; jsReasons?: Array<{ path, reason }> }.
   - Replace current failure output assembly in patch service with the new formatter.
   - Ensure single diagnostics block per failure; preserve header-derived paths for labeling failed diffs; keep existing path fallback logic.

3. Tests
   - Downstream spacing: multiple failed diff files yield one-liners separated by blank lines.
   - STAN repo diagnostics envelope for diff (git stderr; jsdiff-only) and file ops.
   - Ensure no .debug/.rej persistence.
   - Maintain existing path derivation behavior when jsdiff reports “(patch)” (prefer header-derived paths).

4. Assistant guidance (project prompt only)
   - Add/maintain a concise section describing diagnostics consumption, classification (generator vs handler vs drift), and offering choices:
     - Fix now (small + safe),
     - Log a task (defer),
     - Request listings (diff) or unified diffs (file ops) as appropriate.
   - No user-facing docs updates yet; defer until behavior stabilizes.

5. DMP readiness (follow-on)
   - When DMP apply lands, feed its stderr/summary through the same formatter and share the envelopes with diff/file ops behavior.

Backlog (nice to have)

- Optional compression research for transport artifacts (keep plain .tar canonical).
- Additional cross‑checks to keep CLI help and site pages aligned.
- Exec extension (gated, non‑shell) if a repeated, concrete need emerges.

Completed (recent)

- Patch failure prompt path fix:
  - Clipboard/stdout prompt now uses the actual file path instead of "(patch)" when jsdiff reports a generic parse error. The service falls back to header-derived paths when jsdiff does not provide concrete file names.
- File Ops payload alignment:
  - Updated parser/validator/service to accept an unfenced “### File Ops” block (lines after heading up to the next heading); removed fence handling.
  - Adjusted tests accordingly; clarified docs to remove “fenced” wording.

- FEEDBACK removal cleanup:
  - Removed FEEDBACK envelope handling and all related persistence (.rej handling, attempts.json, per‑attempt logs).
  - Deleted dead modules/tests: patch/run/feedback._, patch/run/diagnostics._, patch/rejects.\*, patch/parse.fs.test.ts.
  - Simplified patch detection (no FEEDBACK guard); retained unified‑diff validator.
  - Updated system prompt parts to document clipboard prompts on failures and removed FEEDBACK sections/exceptions.
  - Kept dev‑mode stderr diagnostics (STAN repo only) concise for git/jsdiff/file‑ops.
  - No user‑facing docs updated yet (README etc.) per deferral.

- Requirements & dev plan refactor:
  - Removed FEEDBACK as a supported workflow and specified clipboard prompts for patch and File Ops failures; eliminated diagnostic persistence and .rej handling; retained jsdiff fallback; defined dev‑mode stderr diagnostics for the STAN repo; kept DMP as a first‑class requirement and moved it up the ladder; clarified documentation work to match.

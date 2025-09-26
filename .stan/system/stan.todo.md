# STAN Development Plan

When updated: 2025-09-26 (UTC)

Next up (priority order)

1. Patch failure simplification (remove FEEDBACK and persistence)
   - Remove FEEDBACK envelope generation and any FEEDBACK detection/learning.
   - Remove diagnostics persistence (attempts.json, per‑attempt stderr/stdout files) and all .rej handling; drop the `--reject` attempt from git apply.
   - Patch failure behavior:
     - For each failed file, copy to clipboard: “The unified diff patch for file <path> was invalid. Print a full, post‑patch listing of this file.” If clipboard is unavailable, print to stdout.
   - File Ops failure behavior:
     - ## On any File Ops (### File Ops) failure — parse or execution — copy to clipboard:

       The following File Ops patch failed:

       ```
       <exact quote of file ops patch>
       ```

       ## Perform this operation with unified diff patches instead.

       Also print to stdout if clipboard is unavailable.

   - Dev‑mode (STAN repo only):
     - Print concise failure diagnostics to stderr for test visibility:
       - File Ops: one line per failed op with verb, paths, reason.
       - Git/jsdiff: attempts tried, last exit code, a trimmed last‑stderr excerpt, and jsdiff per‑file reasons.

2. DMP patch support (improve loop fidelity)
   - Accept DMP Patch blocks in `### Patch:` (one patch per file remains mandatory).
   - Implement DMP apply with conservative fuzz and EOL preservation per file.
   - Integrate DMP at the top of the ladder: DMP → git apply (two 3‑way attempts) → jsdiff fallback → clipboard requests for remaining failures.
   - Extend validator to recognize DMP in patches.
   - Tests:
     - Unit tests for DMP parse/apply (insert/replace/delete, boundaries, EOL).
     - Integration: DMP first, fallback sequencing, and clipboard prompts for any remaining failures.

3. Documentation updates
   - System prompt parts: remove FEEDBACK sections/exceptions and reflect the new clipboard‑prompt behavior; keep Response Format and one‑patch‑per‑file rules.
   - README/docs: remove “Patch Workflow & FEEDBACK” references; add concise notes describing failure prompts and DMP support.
   - Ensure examples reflect one‑line clipboard requests and file‑ops failure quote.

Backlog (nice to have)

- Optional compression research for transport artifacts (keep plain .tar canonical).
- Additional cross‑checks to keep CLI help and site pages aligned.
- Exec extension (gated, non‑shell) if a repeated, concrete need emerges.

Completed (recent)

- Requirements & dev plan refactor:
  - Removed FEEDBACK as a supported workflow and specified clipboard prompts for patch and File Ops failures; eliminated diagnostic persistence and .rej handling; retained jsdiff fallback; defined dev‑mode stderr diagnostics for the STAN repo; kept DMP as a first‑class requirement and moved it up the ladder; clarified documentation work to match.

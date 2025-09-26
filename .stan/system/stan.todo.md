# STAN Development Plan

When updated: 2025-09-26 (UTC)

Next up (priority order)

1. DMP patch support (improve loop fidelity)
   - Accept DMP Patch blocks in `### Patch:` (one patch per file remains mandatory).
   - Implement DMP apply with conservative fuzz and EOL preservation per file.
   - Integrate DMP at the top of the ladder: DMP → git apply (two 3‑way attempts) → jsdiff fallback → clipboard requests for remaining failures.
   - Extend validator to recognize DMP in patches.
   - Tests:
     - Unit tests for DMP parse/apply (insert/replace/delete, boundaries, EOL).
     - Integration: DMP first, fallback sequencing, and clipboard prompts for any remaining failures.

2. Documentation updates
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
- Implemented patch failure simplification:
  - Dropped git “--reject” attempt; no .rej handling.
  - Removed persisted diagnostics (attempts.json, per‑attempt logs).
  - On File Ops parse/exec failure: copy quoted File Ops block request to clipboard (stdout fallback), then abort.
  - On unified‑diff failure: copy one‑line listing requests per failed file to clipboard (stdout fallback).
  - Added concise dev‑mode (STAN repo) diagnostics to stderr:
    - File Ops per‑op failures (verb, paths, reason).
    - Git tries/exit/trimmed stderr; jsdiff per‑file reasons.

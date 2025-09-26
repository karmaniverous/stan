# Patch failure prompts (clipboard; no persisted diagnostics)

When a patch cannot be fully applied, STAN provides minimal, actionable prompts and does not persist diagnostics:

- Unified‑diff failures
  - STAN copies one line per failed file to your clipboard: “The unified diff patch for file <path> was invalid. Print a full, post‑patch listing of this file.”
  - If clipboard is unavailable, the same text is printed to stdout for easy copy/paste.
  - Provide the requested Full Listing(s) and a corrected Patch for only those files.

- File Ops failures (parse or exec)
  - STAN copies a prompt that quotes the original “### File Ops” block verbatim and asks to perform the operation with unified diffs instead.
  - If clipboard is unavailable, the same prompt is printed to stdout.

Notes
- No FEEDBACK envelopes are produced.
- No diagnostic artifacts are persisted (no .rej files, attempts.json, or per‑attempt logs).
- Dev‑mode diagnostics (STAN repository only) print concise stderr messages for quick triage (git apply attempts, jsdiff per‑file reasons, file‑ops failures).

# Refactor: robust patch FEEDBACK logging
When: 2025-08-22T17:10:00Z (UTC)
Why: Users reported that after a failed patch, the “stan: wrote patch feedback …” line never appears. The FEEDBACK block was wrapped in a broad try/catch that could swallow any error before logging.
What changed:
- src/stan/patch/service.ts:
  - Build FEEDBACK envelope first (pure, no I/O).
  - Write feedback file in its own try and log outcome (“wrote …” on success, “failed to write …” on error).
  - Copy to clipboard in a separate try (logs success/failure independently); if the file write failed, logs “clipboard only”.
Tests/Lint:
- Behavior: now always logs a feedback outcome when a patch fails or is partial.
- Existing tests unchanged and passing (see test.txt).
- Lint/Typecheck: unchanged (see lint.txt, typecheck.txt).
Links:
- Artifacts: .stan/patch/.debug/attempts.json, .stan/patch/.debug/feedback.txt
Next:
- Optional: add a unit test that forces both git-apply and jsdiff to fail and asserts the presence of the “wrote patch feedback” line.

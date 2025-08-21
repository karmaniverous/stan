# Refactor: archive classifier + FEEDBACK fallback file
When: 2025-08-22T01:45:00Z (UTC)
Why: Exclude binaries from archives and flag large text; provide a reliable FEEDBACK path even when system clipboard is unavailable.

What changed:
- src/stan/classifier.ts: new archive-time classifier
  • Excludes binary files (istextorbinary)
  • Flags large text (size > 1 MB or LOC > 3000)
  • Produces warnings body for archive.warnings.txt
- src/stan/archive.ts:
  • Integrates classifier, excludes binaries from archive payload
  • Always writes <stanPath>/output/archive.warnings.txt and includes it in archive.tar
- src/stan/classifier.test.ts: unit test for classifier service
- src/stan/archive.classifier.behavior.test.ts: ensures archive excludes binaries and includes warnings
- src/stan/patch/index.ts: writes FEEDBACK envelope to <stanPath>/patch/.debug/feedback.txt (in addition to clipboard)

Tests/Lint:
- tests: pass locally except one known Windows EBUSY flake in run.test.ts (unrelated; teardown timing)
- typecheck/docs: clean
- lint: clean

Next:
- Optional: small retry/backoff in the flaky test’s teardown on Windows

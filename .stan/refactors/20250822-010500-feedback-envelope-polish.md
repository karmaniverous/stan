# Refactor: FEEDBACK envelope last-error snippet

When: 2025-08-22T01:05:00Z (UTC)
Why: Improve the clipboard FEEDBACK packet for failed/partial patch applications by including a concise stderr excerpt from the last failing git-apply attempt to speed up triage.

What changed:
- src/stan/patch/feedback.ts: added optional `lastErrorSnippet` to FeedbackEnvelope; included it in the serialized packet.
- src/stan/patch/index.ts: populated `lastErrorSnippet` from the final git-apply attempt’s stderr (first two lines, trimmed to 200 chars) when building the FEEDBACK envelope.

Tests/Lint:
- Tests unchanged; existing suites still pass.
- Lint/typecheck/docs remain clean.

Next:
- Continue P0: implement parse/resolver (per-file hunks) and consider optional DMP fallback; extend tests accordingly.

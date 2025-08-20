# Refactors Log

Short, structured notes to preserve context across chat threads and PRs.

- One file per refactor: `YYYYMMDD-HHMMSS-short-slug.md` (UTC).
- Keep it brief (≈ 10–20 lines). Do not paste large diffs.
- Link to artifacts/commits/PRs instead of duplicating content.

Template:

```
# Refactor: <short title>
When: 2025-08-19T00:00:00Z
Why: 1–2 sentences explaining the requirement or bug.
What changed:
- file-a: brief note
- file-b: brief note

Tests/Lint:
- tests: pass | fail (summary)
- lint: clean | warnings (summary)

Links:
- PR: <url>
- CI: <url> (attach STAN artifacts if available)

Next:
- optional follow-up bullets
```

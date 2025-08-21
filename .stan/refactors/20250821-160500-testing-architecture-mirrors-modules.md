# Refactor: testing architecture mirrors modules; untestable code is a smell

When: 2025-08-21T16:05:00Z (UTC)
Why: Make testing architecture explicit and project‑agnostic: each non‑trivial module must have a paired test; if that’s hard, the design is at fault. Multiple tests targeting one artifact suggest that artifact should be decomposed into smaller modules. Align testing with services‑first (ports/adapters) architecture.
What changed:
- Updated <stanPath>/system/stan.system.md:
  - Added “Testing architecture (mirrors modules)” section: pairing requirement, services/ports vs adapters testing strategy, and design‑smell guidance.
  - Expanded Step‑0 to require test pairing for new modules (or explicit justification in header comments).
Tests/Lint:
- Requirements‑only change; no code altered.
Next:
- All new code proposals must include paired test modules and a brief test plan for services/ports (unit) and adapters (smoke). If pairing is not feasible, return to design and refactor until it is.

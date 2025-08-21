# Refactor: Cardinal SRP for modules + 300‑LOC rule applies to new code

When: 2025-08-21T14:15:00Z (UTC)
Why: Make Single‑Responsibility a first‑class rule for modules (not only functions), and ensure the existing 300‑line guidance explicitly applies to newly generated code. Prefer many small modules over a few large ones; avoid emitting new monoliths.
What changed:
- Updated <stanPath>/system/stan.system.md:
  - Added “Cardinal Design Principles” (SRP for modules; prefer small modules; composability/testability).
  - Clarified in “Default Task / Step 0” that the 300‑line rule applies to newly generated code and requires a split plan before emitting monolithic files.
Tests/Lint:
- Requirements‑only changes; no code paths changed.
Next:
- Enforce during design iterations: if a proposed patch would exceed ~300 LOC in a single module, return to design and propose a module split before coding.

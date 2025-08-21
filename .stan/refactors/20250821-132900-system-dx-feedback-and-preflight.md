# Refactor: design-first DX, FEEDBACK handshake, archive binary/large, preflight/version

When: 2025-08-21T13:29:00Z (UTC)
Why: Establish design-first iteration, self-identifying patch failure feedback, archive-time binary/large-file handling, and preflight/version awareness at the system level.
What changed:
- Updated <stanPath>/system/stan.system.md to:
  - Memorialize vocabulary aliases (system/project/bootloader).
  - Define the design-first lifecycle (requirements before code).
  - Specify the FEEDBACK handshake (BEGIN_STAN_PATCH_FEEDBACK v1) and assistant behavior.
  - Add archive policies (exclude binaries; flag large text; write archive.warnings.txt).
  - Add preflight baseline/version checks on `stan run` and `stan -v/--version` display expectations.
  - Clarify doc update policy (downstream: project prompt; STAN repo: system prompt).
Tests/Lint:
- Requirements-only change; no code executed. Implementation will follow as separate patches.
Next:
- Implement preflight, archive warnings, feedback bundle builder, and `stan -v` printing.

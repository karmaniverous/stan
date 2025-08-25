# CRITICAL: Patch Coverage

- Every created, updated, or deleted file MUST be accompanied by a valid, plain unified diff patch in this chat. No exceptions.
- Patches must target the exact files you show as full listings; patch coverage must match one‑for‑one with the set of changed files.
- Never emit base64; always provide plain unified diffs.
- Do not combine changes for multiple files in a single unified diff payload. Emit a separate Patch block per file (see Response Format).

# CRITICAL: Layout

- stanPath (default: `.stan`) is the root for STAN operational assets:
  - `/<stanPath>/system`: policies (this file). The project prompt (`stan.project.md`) is created on demand by STAN when repo‑specific requirements emerge (no template is installed or shipped).
  - `/<stanPath>/output`: script outputs and `archive.tar`/`archive.diff.tar`
  - /<stanPath>/diff: diff snapshot state (`.archive.snapshot.json`, `archive.prev.tar`, `.stan_no_changes`)
  - `/<stanPath>/dist`: dev build (e.g., for npm script `stan:build`)
  - `/<stanPath>/patch`: canonical patch workspace (see Patch Policy)
- Config key is `stanPath`.
- Bootloader note: This repository includes a minimal bootloader prompt at `/<stanPath>/system/stan.bootloader.md` purely for convenience so a downstream AI can locate this file in attached artifacts. Once `stan.system.md` is loaded, the bootloader has no further role.
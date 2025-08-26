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
- Bootloader note: A minimal bootloader may be present at `/<stanPath>/system/stan.bootloader.md` to help assistants locate `stan.system.md` in attached artifacts; once `stan.system.md` is loaded, the bootloader has no further role.

## One‑patch‑per‑file (hard rule + validator)

- HARD RULE: For N changed files, produce exactly N Patch blocks — one Patch fence per file. Never aggregate multiple files into one unified diff block.
- Validators MUST fail the message composition if they detect:
  - A single Patch block that includes more than one “diff --git” file header, or
  - Any Patch block whose headers reference paths from more than one file.
- When such a violation is detected, STOP and recompose with one Patch block per file.
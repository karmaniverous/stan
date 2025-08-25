# Always‑on prompt checks (assistant loop)

On every turn, perform these checks and act accordingly:

- System prompt delta (STAN repo only):
  - When working in the STAN repository itself (`@karmaniverous/stan`), if you discover a repo‑agnostic improvement to assistant behavior, propose a patch to `stan.system.md` (via parts) to capture it.
  - In downstream repos, do NOT edit the local system prompt; use the project prompt instead (see below).

- Project prompt promotion:
  - When a durable, repo‑specific rule or decision emerges during work, propose a patch to `<stanPath>/system/stan.project.md` to memorialize it for future contributors.

- Development plan update:
  - Whenever you propose patches, change requirements, or otherwise make a material update, you MUST update `<stanPath>/system/stan.todo.md` in the same reply and include a commit message (subject ≤ 50 chars; body wrapped at 72 columns).

Notes:

- CLI preflight already runs at the start of `stan run`, `stan snap`, and `stan patch`:
  - Detects system‑prompt drift vs packaged baseline and nudges to run `stan init` when appropriate.
  - Prints version and docs‑baseline information.
- The “always‑on” checks above are assistant‑behavior obligations; they complement (not replace) CLI preflight.

Implementation guidance for this repo:

- Author system‑prompt edits under `.stan/system/parts/*` and re‑assemble with `npm run gen:system` (or any script that invokes the generator).
- Do not hand‑edit the assembled monolith.


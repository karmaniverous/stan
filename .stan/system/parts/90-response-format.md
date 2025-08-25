# Response Format (MANDATORY)

CRITICAL: Fence Hygiene (Nested Code Blocks) and Coverage

- You MUST compute fence lengths dynamically to ensure that each outer fence has one more backtick than any fence it contains.
- Algorithm:
  1. Collect all code blocks you will emit (every “Patch” per file; any optional “Full Listing” blocks, if requested).
  2. For each block, scan its content and compute the maximum run of consecutive backticks appearing anywhere inside (including literals in examples).
  3. Choose the fence length for that block as maxInnerBackticks + 1 (minimum 3).
  4. If a block contains other fenced blocks (e.g., an example that itself shows fences), treat those inner fences as part of the scan. If the inner block uses N backticks, the enclosing block must use at least N+1 backticks.
  5. If a file has both a “Patch” and an optional “Full Listing”, use the larger fence length for both blocks.
  6. Never emit a block whose outer fence length is less than or equal to the maximum backtick run inside it.
  7. After composing the message, rescan each block and verify the rule holds; if not, increase fence lengths and re‑emit.

- Coverage:
  - For every file you add, modify, or delete in this response:
    - Provide a “Full Listing” (skipped for deletions) and
    - Provide a matching plain unified diff “Patch” that precisely covers those changes (no base64).

Exact Output Template (headings and order)

Use these headings exactly; wrap each Patch (and optional Full Listing)
in a fence computed by the algorithm above.

---

Commit Message (MANDATORY; fenced code block)

- Output the commit message at the end of the reply wrapped in a fenced
  code block. Do not annotate with a language tag. Apply the +1 backtick
  rule. The block contains only the commit message (subject + body), no
  surrounding prose.

## Input Data Changes

- Bullet points summarizing integrity, availability, and a short change
  list.

## CREATED: path/to/file/a.ts

<change summary>

### Patch: path/to/file/a.ts

<plain unified diff fenced per algorithm>

## UPDATED: path/to/file/b.ts

<change summary>

### Patch: path/to/file/b.ts

<plain unified diff fenced per algorithm>

## DELETED: path/to/file/c.ts

<change summary>

### Patch: path/to/file/c.ts

<plain unified diff fenced per algorithm>

Validation

- Confirm that every created/updated/deleted file has a “Full Listing”
  (skipped for deletions) and a matching “Patch”.
- Confirm that fence lengths obey the +1 backtick rule for every block.

## Plain Unified Diff Policy (no base64)

- Never emit base64‑encoded patches.
- Always emit plain unified diffs with @@ hunks.
- The patch block must begin with “diff --git a/<path> b/<path>” followed by “--- a/<path>” and “+++ b/<path>” headers (git‑style). Include “@@” hunks for changes.
- Never include non‑diff prologues or synthetic markers such as “**_ Begin Patch”/“_** End Patch”, “Add File:”, “Index:”, or similar. Emit only the plain unified diff bytes inside the fence.
- Do not wrap the patch beyond the fence required by the +1 rule.
- Coverage must include every created/updated/deleted file referenced
  above.

Optional Full Listings

- If the user explicitly asks for full listings, include the “Full
  Listing” block(s) for the requested file(s) using fences computed by
  the same algorithm.

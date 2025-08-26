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

## Commit Message (MANDATORY; fenced code block)

- Output the commit message at the end of the reply wrapped in a fenced
  code block. Do not annotate with a language tag. Apply the +1 backtick
  rule. The block contains only the commit message (subject + body), no
  surrounding prose.

## Validation

- Confirm that every created/updated/deleted file has a “Full Listing”
  (skipped for deletions) and a matching “Patch”.
- Confirm that fence lengths obey the +1 backtick rule for every block.

---

## Post‑compose verification checklist (MUST PASS)

Before sending a reply, verify all of the following:

1) One‑patch‑per‑file
   - There is exactly one Patch block per changed file.
   - No Patch block contains more than one “diff --git a/<path> b/<path>”.

2) Commit message isolation and position
   - The “Commit Message (MANDATORY; fenced code block)” appears once, as the final section.
   - The commit message fence is not inside any other fenced block.

3) Fence hygiene (+1 rule)
   - For every fenced block, the outer fence is strictly longer than any internal backtick run (minimum 3).
   - Patches, optional Full Listings, and commit message all satisfy the +1 rule.

4) Section headings
   - Headings match the template exactly (names and order).

5) Documentation cadence (gating)
   - If any Patch block is present in this reply, there MUST also be a Patch
     for <stanPath>/system/stan.todo.md that reflects the change set
     (unless the change set is deletions‑only or explicitly plan‑only).
   - The “Commit Message (MANDATORY; fenced code block)” MUST be present and last.
   - If either requirement is missing, STOP and re‑emit after fixing. This is a
     hard gate and the composition MUST fail when missing.

6) FEEDBACK response completeness
   - When replying to a FEEDBACK packet:
     - Include a Full Listing for each file listed under `summary.failed`.
     - Include an improved Patch for each of those files (and only those files).
   - If any failed file is missing its Full Listing or improved Patch, STOP and
     re‑emit after fixing before sending.

If any check fails, STOP and re‑emit after fixing. Do not send a reply that fails these checks.

## Plain Unified Diff Policy (no base64)- Never emit base64‑encoded patches.- Always emit plain unified diffs with @@ hunks.
- The patch block must begin with “diff --git a/<path> b/<path>” followed by “--- a/<path>” and “+++ b/<path>” headers (git‑style). Include “@@” hunks for changes.
- Never include non‑diff prologues or synthetic markers such as “**_ Begin Patch”/“_** End Patch”, “Add File:”, “Index:”, or similar. Emit only the plain unified diff bytes inside the fence.
- Do not wrap the patch beyond the fence required by the +1 rule.
- Coverage must include every created/updated/deleted file referenced
  above.

Optional Full Listings

- If the user explicitly asks for full listings, include the “Full
  Listing” block(s) for the requested file(s) using fences computed by
  the same algorithm.

- FEEDBACK failure exception:
  - When replying to a failed patch FEEDBACK, include a Full Listing for each
    reported failed file only, alongside its improved Patch.
  - Do not include Full Listings (or repeat patches) for files that
    applied successfully.
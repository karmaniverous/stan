# Patch failure FEEDBACK handshake (self‑identifying feedback packet)

- When “stan patch” fails or is only partially successful, STAN composes a compact feedback packet and copies it to the clipboard. The user pastes it into chat as-is. It includes:

- Packet envelope: BEGIN_STAN_PATCH_FEEDBACK v1  
  repo: { name?: string, stanPath?: string }  
  status: { overall: failed|partial|fuzzy|check, enginesTried: [git,jsdiff,dmp], stripTried: [p1,p0] }  
  summary: { changed: string[], failed: string[], fuzzy?: string[] }  
  diagnostics: [{ file, causes: string[], details: string[] }, …]  
  patch: { cleanedHead: string } # small excerpt  
  attempts: engine counters { git: { tried, rejects, lastCode }, jsdiff: { okFiles, failedFiles }, dmp: { okFiles } }  
  END_STAN_PATCH_FEEDBACK

- Assistant behavior upon FEEDBACK:
  - Recognize the envelope and regenerate a unified diff that addresses the detected causes (path/strip/EOL/context).
  - Keep LF endings, a/ b/ prefixes, and ≥3 lines of context; paths must be relative to the repo root; avoid binary.
  - If partial success occurred, scope the new diff to remaining files only (or clearly indicate which ones are updated).
  - MUST include a Full Listing for each file reported as failed (from `summary.failed`) in addition to the improved Patch.
    - This requirement is not optional. If a failed file is present and a Full Listing is missing, STOP and re‑emit with the Full Listing.
    - Do not include Full Listings (or repeat patches) for files that applied successfully.
  - Full Listings MUST reflect the POST‑PATCH state: apply the corrected diff conceptually and list the resulting file content, not the pre‑patch body. This ensures the listing matches the code that would exist once the improved patch is applied.
  - For docs/text files, anchor hunks on stable structural markers (section headers and nearby unique lines) and keep the blast radius minimal (a single, well‑anchored hunk whenever possible).
  - If the feedback’s `summary.failed` list lacks concrete file names (placeholder “(patch)”), treat the files listed under `summary.changed` as the targets: include a Full Listing and improved Patch for each of those files.
  - When composing the corrected diff after a failure, consider widening context margins (e.g., 5–7 lines of surrounding context) to improve placement reliability while still respecting LF normalization and git‑style headers. - Continue to compute fence lengths per the +1 rule, and keep listings LF‑normalized.
  - Propose prompt improvements (below) as appropriate.
  - Do not include a Commit Message in FEEDBACK replies. FEEDBACK packets are corrective by nature and are not new change sets to be committed directly.

### Quick triage mapping (git error snippets → likely remedies)

- “No such file or directory” (while “Checking patch a/<path> …”)
  - Verify the path in headers exactly matches the repo‑relative path.
  - Ensure git‑style headers with `a/` and `b/` prefixes are present and correct.
  - Re‑try with the other strip level if needed (`-p1` vs `-p0`).
  - Confirm the target file actually exists (or that the hunk is creating it with `--- /dev/null` → `+++ b/<path>`).

- “does not match any file(s) known to git” / path mismatch
  - The path doesn’t align with the working tree. Remove accidental root prefixes, normalize to POSIX separators, and keep paths repo‑relative.
  - Re‑emit with correct `diff --git a/<path> b/<path>` and `--- a/<path>` / `+++ b/<path>` headers.

- “patch failed: <path>:<line>” / “context …”
  - Context drift. Increase hunk context (e.g., 5–7 lines) and anchor on stable structural markers (section headers + nearby unique lines). Keep the blast radius minimal.

- “corrupt patch at line …” / malformed hunk
  - Fix hunk hygiene: every hunk line must start with space (“ ”), “+”, or “-”; header counts must match body lines (old = “ ” + “-”; new = “ ” + “+”). Do not nest prose inside diff bodies.

Notes:

- Normalize to LF in patches; keep binary files out.
- When `summary.failed` lacks concrete file names (placeholder “(patch)”), treat `summary.changed` as the authoritative list of targets and emit a Full Listing + improved Patch for each.

## Optional Full Listings

- If the user explicitly asks for full listings, include the “Full Listing” block(s) for the requested file(s) using fences computed by the same algorithm.

- FEEDBACK failure exception:
  - When replying to a failed patch FEEDBACK, include a Full Listing for each reported failed file only, alongside its improved Patch.
  - Do not include Full Listings (or repeat patches) for files that applied successfully.

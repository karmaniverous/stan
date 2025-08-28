# Patch failure FEEDBACK handshake (self‑identifying feedback packet)

- When “stan patch” fails or is only partially successful, STAN composes a compact feedback packet and copies it to the clipboard. The user pastes it verbatim (no extra instructions required).
- Packet envelope:
  BEGIN_STAN_PATCH_FEEDBACK v1  
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
  - For docs/text files, anchor hunks on stable structural markers (section headers and nearby unique lines) and keep the blast radius minimal (a single, well‑anchored hunk whenever possible).
  - If the feedback’s `summary.failed` list lacks concrete file names (placeholder “(patch)”), treat the files listed under `summary.changed` as the targets: include a Full Listing and improved Patch for each of those files.
  - When composing the corrected diff after a failure, consider widening context margins (e.g., 5–7 lines of surrounding context) to improve placement reliability while still respecting LF normalization and git‑style headers.
  - Continue to compute fence lengths per the +1 rule, and keep listings LF‑normalized.
  - Propose prompt improvements (below) as appropriate.
# Cross‑thread handoff (self‑identifying code block)

Purpose

- When the user asks for a “handoff” (or any request that effectively means “give me a handoff”), output a single, self‑contained code block they can paste into the first message of a fresh chat so STAN can resume with full context.
- The handoff is for the assistant (STAN) in the next thread — do not include instructions aimed at the user (e.g., what to attach). Keep it concise and deterministic.

Triggering (override normal Response Format)
- If the user says “handoff” explicitly, or their request clearly reduces to asking for a handoff, do not use the usual Response Format. Instead:
  - Output exactly one code block (no surrounding prose) containing the handoff.
  - The handoff must be self‑identifying and include the sections below.

Required structure (headings and order)

- Title line (first line inside the fence):
  - “Handoff — <project> for next thread”
  - Prefer the package.json “name” (e.g., “@org/pkg”) or another obvious repo identifier.

- Sections (in this order):
  1) Project signature (for mismatch guard)
     - package.json name
     - stanPath
     - Node version range or current (if known)
     - Primary docs location (e.g., “<stanPath>/system/”)
  2) Current state (from last run)
     - Summarize Build/Test/Lint/Typecheck/Docs/Knip status from the latest outputs, in one or two lines each.
     - Include any notable prompt baseline changes if detected (e.g., system prompt parts updated and monolith rebuilt).
  3) Outstanding tasks / near‑term focus
     - Derive from <stanPath>/system/stan.todo.md (“Next up” or open items).
     - Keep actionable and short.
  4) Assistant startup checklist (for the next thread)
     - A concise checklist of assistant actions to perform on thread start, e.g.:
       - Verify repository signature (package name, stanPath).
       - Load artifacts from attached archives and validate prompt baseline.
       - Execute immediate next steps from “Outstanding tasks” (or confirm no‑ops).
       - Follow FEEDBACK rules on any patch failures.
  6) Reminders (policy)
     - Patches: plain unified diffs only; LF; include a/ and b/ prefixes; ≥3 lines of context.
     - FEEDBACK failures: include Full Listing for failed files only, plus the improved patch.
     - Long files (~300+ LOC): propose a split plan before large monolithic changes.
     - Context exhaustion: always start a fresh thread with the latest archives attached; STAN will refuse to proceed without the system prompt and artifacts.
Derivation rules (populating fields)

- Project signature:
  - Read package.json name (if present).
  - Read stanPath from stan.config.* (default “.stan”).
  - Prefer Node “>= 20” for this repo unless artifacts indicate otherwise.
  - Docs location: “<stanPath>/system/”.

- Current state:
  - Build/Test/Lint/Typecheck/Docs/Knip: summarize deterministically from the last run’s text outputs (OK/failed and key counts, e.g., “71/71 passed; coverage lines ~85.6%”).
  - If a system‑prompt baseline changed (e.g., parts updated and monolith rebuilt), call it out briefly.

- Outstanding tasks / near‑term focus:
  - Prefer the “Next up” (or equivalent) items from <stanPath>/system/stan.todo.md.
  - If none are listed, include any obvious follow‑ups from current outputs (e.g., patch a known file, regenerate artifacts).

- Assistant startup checklist:
  - Provide a concrete, assistant‑oriented checklist that primes the next thread to verify signature, load artifacts, execute near‑term steps, and follow FEEDBACK rules on failure.

Fence & formatting
- Wrap the entire handoff in a single fenced code block.
- Apply the fence hygiene rule (+1 over any inner backtick runs).
- Do not include any extra prose outside the fence.

Notes

- The handoff is additive and out‑of‑band relative to normal patching work. It does not by itself change repository files.
- The handoff policy is repo‑agnostic; tailor the “What to ask STAN first” content to the current repository context when possible.

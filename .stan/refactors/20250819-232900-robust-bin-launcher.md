# Refactor: robust CLI bin launcher

When: 2025-08-19T23:29:00Z
Why: Running the CLI via npm/pnpm/yarn bin shims didn't start due to a brittle "executed directly" check. Provide a dedicated launcher.
What changed:

- Added src/cli/stan/stan.ts that always runs `makeCli().parseAsync()`
- Updated rollup.config.ts to build both index.ts and stan.ts for the CLI
- Updated package.json bin to "dist/cli/stan.js"
  Tests/Lint:
- Behavior: bin now runs reliably via shims; programmatic `makeCli` imports unaffected
- Lint/Typecheck: unchanged
  Next:
- Optionally remove the isDirect guard from index.ts in a future major/minor since the launcher supersedes it

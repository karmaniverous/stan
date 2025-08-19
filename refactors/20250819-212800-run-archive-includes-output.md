# Refactor: test that archive.tar includes output dir with -a -c

When: 2025-08-19T21:28:00Z
Why: In practice `stan run -a -c` produced a regular archive missing the output dir. Existing tests didn’t assert inclusion for archive.tar; only diff behavior was verified.
What changed:

- Added src/stan/run.combine.archive.behavior.test.ts to run the encapsulated archiver via runSelected, mocking tar to capture arguments.
- Asserts that the files list for archive.tar contains entries under <outputPath>.
  Tests/Lint:
- New test passes with mocked tar; complements the existing diff combine test.
  Next:
- If you want to also assert exclusions for the regular archive (e.g., omit <outputPath>/.diff), we can extend the test with a filter-aware version of createArchive.

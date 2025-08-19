Explanation of changes:
Why: Two CLI tests still returned selection=null; prior fallback relied only on parent tokens, which can be empty in some parse paths. We must aggregate tokens from both the current command and its parent to recover operands robustly.
What changed: Added token aggregation (command.rawArgs/args + parent.rawArgs/args) and a unified parser that skips -e/--except blocks and collects operands. Fall back to this only if action parameter and command.args yielded no known keys. Lint/type-safety preserved.
Tests/Lint: Expected to resolve the remaining two CLI test failures; ESLint remains clean.

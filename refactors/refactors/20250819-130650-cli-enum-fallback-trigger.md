Explanation of changes (link to requirements):
Why: enumeration fallback to parent tokens only ran when the intermediate list was empty, missing cases where it was non-empty but contained no known script keys. Tests still showed selection=null.
What changed: Trigger parent-token fallback when no known keys were found in the earlier sources, then filter/dedupe. Keeps lint/type-safety; no user-facing behavior change aside from fixing selection.
Tests/Lint: Expected to resolve the remaining two CLI test failures; lint remains clean.

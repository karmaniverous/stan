---
title: CLI Usage & Examples
---

# CLI usage & examples

## Defaults

The default run executes all configured scripts and writes regular and diff archives:

```
stan run
```

Preview the plan without side effects:

```
stan run -p
```

Skip scripts or archives:

```
stan run -S          # no scripts
stan run -A          # no archives
stan run -S -A -p    # plan only (nothing to do)
```

## Selection

Run specific scripts:

```
stan run -s test lint
```

Run all except a subset:

```
stan run -x test
```

Sequential execution (preserves -s order):

```
stan run -q -s lint test
```

## Archives

Include outputs inside archives and remove on-disk outputs:

```
stan run -c -s test
```

Keep on-disk outputs:

```
stan run -k
```

## Patching

Apply a unified diff from clipboard (default), argument, or file:

```
stan patch
stan patch --check
stan patch -f changes.patch
```

On patch failure, STAN writes a compact FEEDBACK envelope and (when possible)
copies it to your clipboard — paste it into chat to receive a corrected diff.

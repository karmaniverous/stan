// src/cli/stan/run-args.ts
/* src/cli/stan/run-args.ts
 * Pure derivation of run invocation parameters from enumerated args and flags.
 * This is intentionally free of Commander coupling so tests can cover behavior
 * deterministically.
 *
 * REQUIREMENTS:
 * - Given enumerated (string | string[] | unknown) and flags (unknown),
 *   compute:
 *   - selection: string[] | null (null => run all). Filter to known keys
 *     (config.scripts), dedupe, preserve order.
 *     Apply --except: when selection===null, treat as "all minus except".
 *   - mode: 'sequential' when -s/--sequential was set (here: sequential flag).
 *   - behavior: { combine, keep, diff, archive } mapped from flags.
 */
import type { ContextConfig } from '@/stan/config';
import type { ExecutionMode, RunBehavior } from '@/stan/run';

const stringsFrom = (v: unknown): string[] => {
  const out: string[] = [];
  const walk = (x: unknown): void => {
    if (typeof x === 'string') {
      out.push(x);
    } else if (Array.isArray(x)) {
      for (const el of x) walk(el);
    }
  };
  walk(v);
  return out;
};

const computeSelection = (
  allKeys: string[],
  enumerated: string[] | null,
  except: string[] | null,
): string[] | null => {
  let selected: string[] | null =
    enumerated && enumerated.length ? [...enumerated] : null;

  if (except && except.length) {
    const base = selected ?? allKeys;
    selected = base.filter((k) => !except.includes(k));
  }
  return selected;
};

export type DerivedRunInvocation = {
  selection: string[] | null;
  mode: ExecutionMode;
  behavior: RunBehavior;
};

/** Derive runSelected inputs without touching Commander internals. */
export const deriveRunInvocation = (args: {
  enumerated: unknown;
  except?: unknown;
  sequential?: unknown;
  combine?: unknown;
  keep?: unknown;
  diff?: unknown;
  archive?: unknown;
  config: ContextConfig;
}): DerivedRunInvocation => {
  const {
    enumerated,
    except,
    sequential,
    combine,
    keep,
    diff,
    archive,
    config,
  } = args;

  const allKeys = Object.keys(config.scripts);
  const known = new Set(allKeys);

  // Positional operands => enumerated candidates
  const rawEnum = stringsFrom(enumerated);
  const enumFiltered = rawEnum.filter((k) => known.has(k));
  const enumUnique = enumFiltered.filter(
    (k, i) => enumFiltered.indexOf(k) === i,
  );

  // Except values (variadic already handled by caller or Commander; we just normalize)
  const rawExcept = stringsFrom(except);
  const exceptFiltered = rawExcept.filter((k) => known.has(k));
  const exceptUnique = exceptFiltered.filter(
    (k, i) => exceptFiltered.indexOf(k) === i,
  );

  const selection = computeSelection(
    allKeys,
    enumUnique.length ? enumUnique : null,
    exceptUnique.length ? exceptUnique : null,
  );

  const mode: ExecutionMode = sequential ? 'sequential' : 'concurrent';

  const behavior: RunBehavior = {
    combine: Boolean(combine),
    keep: Boolean(keep),
    diff: Boolean(diff),
    archive: Boolean(archive),
  };

  return { selection, mode, behavior };
};

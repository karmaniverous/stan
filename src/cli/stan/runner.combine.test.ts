import { describe, expect, it } from 'vitest';

import type { ContextConfig } from '@/stan/config';

import { deriveRunInvocation } from './run-args';

describe('CLI -c/--combine and -k/--keep', () => {
  const cfg: ContextConfig = {
    outputPath: 'stan',
    combinedFileName: 'bundle',
    scripts: { test: 'echo test', lint: 'echo lint' },
  };

  it('passes combine and keep flags to the runner (no enumeration)', () => {
    const d = deriveRunInvocation({
      enumerated: [],
      combine: true,
      keep: true,
      config: cfg,
    });
    expect(d.selection).toBeNull(); // run all
    expect(d.mode).toBe('concurrent');
    expect(d.behavior).toMatchObject({ combine: true, keep: true });
  });

  it('honors combinedFileName from config when combining', () => {
    const d = deriveRunInvocation({
      enumerated: ['lint'],
      combine: true,
      config: cfg,
    });
    expect(d.selection).toEqual(['lint']);
    expect(d.behavior).toMatchObject({
      combine: true,
      combinedFileName: 'bundle',
    });
  });
});

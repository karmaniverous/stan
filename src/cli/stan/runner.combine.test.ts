// src/cli/stan/runner.combine.test.ts
import { describe, expect, it } from 'vitest';

import type { ContextConfig } from '@/stan/config';

import { deriveRunInvocation } from './run-args';

describe('CLI -c/--combine, -k/--keep, -a/--archive', () => {
  const cfg: ContextConfig = {
    outputPath: 'stan',
    scripts: { test: 'echo test', lint: 'echo lint' },
  };

  it('passes combine, keep, archive flags to the runner (no enumeration)', () => {
    const d = deriveRunInvocation({
      enumerated: [],
      combine: true,
      keep: true,
      archive: true,
      config: cfg,
    });
    expect(d.selection).toBeNull(); // run all
    expect(d.mode).toBe('concurrent');
    expect(d.behavior).toMatchObject({
      combine: true,
      keep: true,
      archive: true,
    });
  });

  it('filters selection to known keys and preserves order', () => {
    const d = deriveRunInvocation({
      enumerated: ['lint', 'test', 'nope'],
      archive: true,
      config: cfg,
    });
    expect(d.selection).toEqual(['lint', 'test']);
    expect(d.behavior.archive).toBe(true);
  });
});

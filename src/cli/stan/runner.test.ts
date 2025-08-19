import { describe, expect, it } from 'vitest';

import type { ContextConfig } from '@/stan/config';

import { deriveRunInvocation } from './run-args';

describe('CLI argument parsing', () => {
  const cfg: ContextConfig = {
    outputPath: 'stan',
    scripts: { test: 'echo test', lint: 'echo lint' },
  };

  it('passes -e selection with provided keys (all except <keys>)', () => {
    const d = deriveRunInvocation({
      enumerated: [], // no explicit operands
      except: ['test'],
      sequential: false,
      combine: false,
      keep: false,
      config: cfg,
    });
    expect(d.selection).toEqual(['lint']); // all except 'test'
    expect(d.mode).toBe('concurrent');
  });

  it('passes -s to run sequentially and preserves enumerated order', () => {
    const d = deriveRunInvocation({
      enumerated: ['lint', 'test'],
      sequential: true,
      config: cfg,
    });
    expect(d.selection).toEqual(['lint', 'test']);
    expect(d.mode).toBe('sequential');
  });
});

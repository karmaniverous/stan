import { describe, expect, it } from 'vitest';

import { parseFileOpsBlock } from './file-ops';

const msg = [
  '## UPDATED: docs',
  '',
  '### File Ops',
  '```',
  'mkdirp src/new/dir',
  'mv src/old.txt src/new/dir/new.txt',
  'rm src/tmp.bin',
  'rmdir src/legacy/empty',
  '```',
  '',
  '### Patch: docs',
  '```',
  'diff --git a/README.md b/README.md',
  '--- a/README.md',
  '+++ b/README.md',
  '@@ -1,1 +1,1 @@',
  '-old',
  '+new',
  '```',
  '',
].join('\n');

describe('file-ops parser', () => {
  it('extracts verbs and normalized repo-relative paths', () => {
    const plan = parseFileOpsBlock(msg);
    expect(plan.errors.length).toBe(0);
    expect(plan.ops.length).toBe(4);
    expect(plan.ops[0]).toEqual({ verb: 'mkdirp', src: 'src/new/dir' });
    expect(plan.ops[1]).toEqual({
      verb: 'mv',
      src: 'src/old.txt',
      dest: 'src/new/dir/new.txt',
    });
    expect(plan.ops[2]).toEqual({ verb: 'rm', src: 'src/tmp.bin' });
    expect(plan.ops[3]).toEqual({ verb: 'rmdir', src: 'src/legacy/empty' });
  });

  it('rejects absolute and traversal paths', () => {
    const bad = [
      '### File Ops',
      '```',
      'rm /etc/passwd',
      'mv src/a ../b',
      '```',
    ].join('\n');
    const plan = parseFileOpsBlock(bad);
    expect(plan.ops.length).toBe(0);
    expect(plan.errors.some((e) => /invalid repo-relative path/.test(e))).toBe(
      true,
    );
  });
});

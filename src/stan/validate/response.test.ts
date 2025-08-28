import { describe, expect, it } from 'vitest';

import {
  __internal,
  validateOrThrow,
  validateResponseMessage,
} from './response';

const makeOkMessage = (): string => {
  return [
    '## UPDATED: src/x.ts',
    '',
    '### Patch: src/x.ts',
    '```',
    'diff --git a/src/x.ts b/src/x.ts',
    '--- a/src/x.ts',
    '+++ b/src/x.ts',
    '@@ -1,1 +1,1 @@',
    '-old',
    '+new',
    '```',
    '',
    '## UPDATED: .stan/system/stan.todo.md',
    '',
    '### Patch: .stan/system/stan.todo.md',
    '```',
    'diff --git a/.stan/system/stan.todo.md b/.stan/system/stan.todo.md',
    '--- a/.stan/system/stan.todo.md',
    '+++ b/.stan/system/stan.todo.md',
    '@@ -1,1 +1,1 @@',
    '-before',
    '+after',
    '```',
    '',
    '## Commit Message',
    '```',
    'feat: sample',
    '',
    'When: 2025-08-28',
    'Why: test',
    'What changed:',
    '- src/x.ts',
    '- .stan/system/stan.todo.md',
    '```',
    '',
  ].join('\n');
};

describe('response-format validator', () => {
  it('OK message passes', () => {
    const res = validateResponseMessage(makeOkMessage());
    expect(res.ok).toBe(true);
    expect(res.errors).toEqual([]);
  });

  it('fails when TODO patch is missing', () => {
    const bad = makeOkMessage().replace(
      /## UPDATED: \.stan\/system\/stan\.todo\.md[\s\S]*?```[\s\S]*?```/m,
      '',
    );
    const res = validateResponseMessage(bad);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => /Doc cadence/.test(e))).toBe(true);
  });

  it('fails when a Patch block contains multiple diff --git headers', () => {
    // Replace the entire first UPDATED section (including its Patch) with a block that contains two diff headers.
    const bad = makeOkMessage().replace(
      /## UPDATED: src\/x\.ts[\s\S]*?## UPDATED:/m,
      [
        '## UPDATED: src/x.ts',
        '',
        '### Patch: src/x.ts',
        '```',
        'diff --git a/src/x.ts b/src/x.ts',
        '--- a/src/x.ts',
        '+++ b/src/x.ts',
        '@@ -1,1 +1,1 @@',
        '-old',
        '+new',
        'diff --git a/src/y.ts b/src/y.ts',
        '--- a/src/y.ts',
        '+++ b/src/y.ts',
        '@@ -1,1 +1,1 @@',
        '-a',
        '+b',
        '```',
        '',
        '## UPDATED:',
      ].join('\n'),
    );
    const res = validateResponseMessage(bad);
    expect(res.ok).toBe(false);
    expect(
      res.errors.some((e) => /contains multiple "diff --git"/.test(e)),
    ).toBe(true);
  });
  it('fails when two Patch blocks target the same file', () => {
    const bad = makeOkMessage().replace(
      /## Commit Message[\s\S]*$/,
      [
        '## UPDATED: src/x.ts',
        '',
        '### Patch: src/x.ts',
        '```',
        'diff --git a/src/x.ts b/src/x.ts',
        '--- a/src/x.ts',
        '+++ b/src/x.ts',
        '@@ -1,1 +1,1 @@',
        '-z',
        '+z',
        '```',
        '',
        '## Commit Message',
        '```',
        'msg',
        '```',
        '',
      ].join('\n'),
    );
    const res = validateResponseMessage(bad);
    expect(res.ok).toBe(false);
    expect(
      res.errors.some((e) => /Multiple Patch blocks.*src\/x\.ts/.test(e)),
    ).toBe(true);
  });

  it('fails when commit message is not last', () => {
    const bad = makeOkMessage().replace(
      /## Commit Message[\s\S]*$/,
      [
        '## Commit Message',
        '```',
        'msg',
        '```',
        '',
        '## UPDATED: tail',
        '### Patch: tail',
        '```',
        'diff --git a/tail b/tail',
        '--- a/tail',
        '+++ b/tail',
        '@@ -1,1 +1,1 @@',
        '-x',
        '+y',
        '```',
        '',
      ].join('\n'),
    );
    const res = validateResponseMessage(bad);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => /Commit Message.*not last/.test(e))).toBe(
      true,
    );
  });

  it('fails when Full Listing precedes Patch for the same file', () => {
    const bad = makeOkMessage().replace(
      /## UPDATED: src\/x\.ts[\s\S]*?## UPDATED:/m,
      [
        '## UPDATED: src/x.ts',
        '',
        '### Full Listing: src/x.ts',
        '```',
        '// listing',
        '```',
        '',
        '### Patch: src/x.ts',
        '```',
        'diff --git a/src/x.ts b/src/x.ts',
        '--- a/src/x.ts',
        '+++ b/src/x.ts',
        '@@ -1,1 +1,1 @@',
        '-old',
        '+new',
        '```',
        '',
        '## UPDATED:',
      ].join('\n'),
    );
    const res = validateResponseMessage(bad);
    expect(res.ok).toBe(false);
    expect(
      res.errors.some((e) => /Full Listing appears before Patch/.test(e)),
    ).toBe(true);
  });

  it('validateOrThrow throws with a readable message', () => {
    expect(() => validateOrThrow('## Commit Message\n```\nmsg\n```\n')).toThrow(
      /validation failed/i,
    );
  });
});

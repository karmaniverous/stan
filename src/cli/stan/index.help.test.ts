// src/cli/stan/index.help.test.ts
import { describe, expect, it, vi } from 'vitest';

// Mock the help footer to a known marker before importing the CLI factory.
vi.mock('@/stan/help', () => ({
  renderAvailableScriptsHelp: () => '\nMOCK HELP FOOTER\n',
}));

import { makeCli } from '@/cli/stan/index';

describe('CLI help footer and subcommand registration', () => {
  it('prints help with custom footer and registers subcommands', async () => {
    const cli = makeCli();

    let out = '';
    const writeSpy = vi
      .spyOn(process.stdout, 'write')
      // @ts-expect-error allow any chunk
      .mockImplementation((chunk: unknown) => {
        out += String(chunk);
        return true;
      });

    // Trigger help output; exitOverride swallows process.exit
    await cli.parseAsync(['node', 'stan', '--help'], { from: 'user' });

    expect(out).toContain('MOCK HELP FOOTER');

    // Subcommands should include run, init, snap, patch
    const subNames = cli.commands.map((c) => c.name());
    expect(subNames).toEqual(
      expect.arrayContaining(['run', 'init', 'snap', 'patch']),
    );

    writeSpy.mockRestore();
  });
});

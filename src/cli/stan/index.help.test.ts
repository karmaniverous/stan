import { describe, expect, it, vi } from 'vitest';

// Mock the help footer to a known marker before importing the CLI factory.
vi.mock('@/stan/help', () => ({
  renderAvailableScriptsHelp: () => '\nMOCK HELP FOOTER\n',
}));

import { makeCli } from '@/cli/stan/index';

describe('CLI help footer and subcommand registration', () => {
  it('prints help with custom footer and registers subcommands', async () => {
    const cli = makeCli();

    let printed = '';
    // outputHelp(cb) allows capturing the composed help (incl. addHelpText) without exiting.
    cli.outputHelp((str) => {
      printed += str;
      return str;
    });

    expect(printed).toContain('MOCK HELP FOOTER');

    // Subcommands should include run, init, snap, patch
    const subNames = cli.commands.map((c) => c.name());
    expect(subNames).toEqual(
      expect.arrayContaining(['run', 'init', 'snap', 'patch']),
    );
  });
});

// src/cli/stan/index.help.test.ts
import { describe, expect, it, vi } from 'vitest';

// Mock the help footer to a known marker before importing the CLI factory.
vi.mock('@/stan/help', () => ({
  renderAvailableScriptsHelp: () => '\nMOCK HELP FOOTER\n',
}));

import { makeCli } from '@/cli/stan/index';

describe('CLI help footer and subcommand registration', () => {
  it('appends help footer from renderAvailableScriptsHelp and registers subcommands', () => {
    const cli = makeCli();
    const help = cli.helpInformation();

    // Help contains our mocked footer
    expect(help).toContain('MOCK HELP FOOTER');

    // Subcommands should include run, init, snap, patch
    const subNames = cli.commands.map((c) => c.name());
    expect(subNames).toEqual(
      expect.arrayContaining(['run', 'init', 'snap', 'patch']),
    );
  });
});

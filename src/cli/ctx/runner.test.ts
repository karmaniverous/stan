import { tmpdir } from 'node:os';
import path from 'node:path';

import { Command } from '@commander-js/extra-typings';
import { afterEach, describe, expect, it, type Mock,vi } from 'vitest';

import { runCtx } from './runner';

// Partial mocks so we can intercept calls
vi.mock('../../context/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../context/config')>();
  return {
    ...actual,
    findConfigPathSync: vi.fn(),
    loadConfig: vi.fn(),
  };
});

vi.mock('./init', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./init')>();
  return {
    ...actual,
    performInit: vi.fn(),
  };
});

vi.mock('../../context/run', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../context/run')>();
  return {
    ...actual,
    generateWithConfig: vi.fn(),
  };
});

vi.mock('../../context/archive', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../context/archive')>();
  return {
    ...actual,
    createArchive: vi.fn(),
  };
});

const { findConfigPathSync, loadConfig } = await import('../../context/config');
const { performInit } = await import('./init');
const { generateWithConfig } = await import('../../context/run');

afterEach(() => {
  vi.resetAllMocks();
});

describe('runCtx', () => {
  it('auto-inits when no config is found', async () => {
    (findConfigPathSync as unknown as Mock).mockReturnValue(null);

    const cli = new Command().name('ctx');
    const cwd = path.join(tmpdir(), 'ctx-auto-init');

    await runCtx(cli, undefined, cwd);

    expect(performInit).toHaveBeenCalledTimes(1);
    expect(generateWithConfig).not.toHaveBeenCalled();
  });

  it('proceeds with generation when config exists', async () => {
    (findConfigPathSync as unknown as Mock).mockReturnValue('ctx.config.yml');
    (loadConfig as unknown as Mock).mockResolvedValue({ outputPath: 'ctx', scripts: {} });

    const cli = new Command().name('ctx');
    const cwd = path.join(tmpdir(), 'ctx-run');

    await runCtx(cli, undefined, cwd);

    expect(generateWithConfig).toHaveBeenCalledTimes(1);
    expect(performInit).not.toHaveBeenCalled();
  });
});

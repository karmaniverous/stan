/**
 * REQUIREMENTS (applies to this file)
 * - For each key under `scripts`, run the command and write output to `<outputPath>/<key>.txt`. [req-run-scripts]
 * - Use the same agent that runs NPM scripts (i.e., the system shell). [req-use-shell]
 * - Running `context [key]` should generate only that file (including `archive`). [req-key-only]
 * - Running `context` with no key should generate all files. [req-generate-all]
 * - Always create the output directory if needed. [req-output-dir]
 */
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { createArchive } from './archive';
import { ensureOutputDir, type ContextConfig } from './config';

/** Execute a shell command and return combined stdout+stderr. [req-use-shell] */
export const runShell = async (
  command: string,
  cwd: string,
): Promise<{ code: number; output: string }> =>
  new Promise((resolve) => {
    // Wrap in platform shell and redirect stderr to stdout to preserve ordering.
    const isWin = process.platform === 'win32';
    const shell = isWin ? 'cmd' : 'sh';
    const args = isWin ? ['/d', '/s', '/c', `${command} 2>&1`] : ['-c', `${command} 2>&1`];

    const child = spawn(shell, args, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    });

    const chunks: Buffer[] = [];
    child.stdout.on('data', (c: Buffer) => chunks.push(c));
    child.on('close', (code: number | null) => {
      resolve({ code: code ?? -1, output: Buffer.concat(chunks).toString('utf8') });
    });
  });

/**
 * Generate outputs for a supplied config (no disk config read).
 * This is the core orchestrator used by both the CLI and tests.
 */
export const generateWithConfig = async (
  config: ContextConfig,
  {
    cwd = process.cwd(),
    key,
  }: {
    /** Project root. */
    cwd?: string;
    /** If provided, generate only this key ("archive" allowed). */
    key?: string | undefined;
  } = {},
): Promise<string[]> => {
  const outAbs = await ensureOutputDir(cwd, config.outputPath);

  const created: string[] = [];

  // Archive generation. [req-archive-always] + [req-key-only] + [req-generate-all]
  if (!key || key === 'archive') {
    await createArchive({ cwd, outputPath: config.outputPath });
    created.push(path.join(outAbs, 'archive.tar'));
    // If a specific non-archive key was requested, skip scripts entirely.
    if (key === 'archive') return created;
  }

  // Determine which scripts to run. [req-key-only] + [req-generate-all]
  const entries = key
    ? (config.scripts[key] ? ([([key, config.scripts[key]] as const)]) : [])
    : (Object.entries(config.scripts) as ReadonlyArray<readonly [string, string]>);

  if (key && entries.length === 0) {
    throw new Error(
      `context: key "${key}" not found in config.scripts. Available: ${Object.keys(config.scripts).join(', ')}`,
    );
  }

  // Sequential execution to keep output deterministic.
  for (const [k, cmd] of entries) {
    const { output } = await runShell(cmd, cwd);
    const dest = path.join(outAbs, `${k}.txt`);
    await writeFile(dest, output, 'utf8'); // [req-run-scripts]
    created.push(dest);
  }

  return created;
};

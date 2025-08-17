/**
 * REQUIREMENTS
 * - Run all artifacts concurrently when no key is provided (archive + every script). [req-concurrent-all]
 * - For each key under `scripts`, run the command and write output to `<outputPath>/<key>.txt`. [req-run-scripts]
 * - Use the same agent that runs NPM scripts (i.e., the system shell). [req-use-shell]
 * - `ctx [key]` should generate only that file (including `archive`). [req-key-only]
 * - Always create the output directory if needed. [req-output-dir]
 * - Print a console message when each task begins and ends (with duration). [req-logging]
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

/** Internal: run one script key, write its output file, and log start/end. */
const runOneScript = async (
  k: string,
  cmd: string,
  cwd: string,
  outAbs: string,
): Promise<string> => {
  const dest = path.join(outAbs, `${k}.txt`);
  const started = Date.now();
  console.log(`ctx: start "${k}" (${cmd})`); // [req-logging]

  const { output } = await runShell(cmd, cwd);
  await writeFile(dest, output, 'utf8');

  const elapsed = Date.now() - started;
  console.log(`ctx: done "${k}" in ${String(elapsed)}ms -> ${path.relative(cwd, dest)}`); // [req-logging]

  return dest;
};

/** Internal: run archive task, and log start/end. */
const runArchive = async (cwd: string, outputPath: string, outAbs: string): Promise<string> => {
  const started = Date.now();
  console.log('ctx: start "archive"'); // [req-logging]

  const { archivePath, fileCount } = await createArchive({ cwd, outputPath });

  const elapsed = Date.now() - started;
  console.log(
    `ctx: done "archive" in ${String(elapsed)}ms -> ${path.relative(cwd, archivePath)} (${String(
      fileCount,
    )} files)`,
  ); // [req-logging]

  return archivePath;
};

/** Generate outputs for a supplied config (used by CLI and tests). */
export const generateWithConfig = async (
  config: ContextConfig,
  {
    cwd = process.cwd(),
    key,
  }: {
    cwd?: string;
    key?: string | undefined;
  } = {},
): Promise<string[]> => {
  const outAbs = await ensureOutputDir(cwd, config.outputPath);

  // Single-key mode: just one task (script or archive). [req-key-only]
  if (key) {
    if (key === 'archive') {
      const a = await runArchive(cwd, config.outputPath, outAbs);
      return [a];
    }
    const cmd = config.scripts[key];
    if (!cmd) {
      throw new Error(
        `context: key "${key}" not found in config.scripts. Available: ${Object.keys(
          config.scripts,
        ).join(', ')}`,
      );
    }
    const f = await runOneScript(key, cmd, cwd, outAbs);
    return [f];
  }

  // No key: run archive + *all* scripts concurrently. [req-concurrent-all]
  const tasks: Array<Promise<string>> = [];

  tasks.push(
    runArchive(cwd, config.outputPath, outAbs).catch((e) => {
      console.error(`ctx: failed "archive": ${e instanceof Error ? e.message : String(e)}`);
      process.exitCode = 1;
      throw e;
    }),
  );

  for (const [k, cmd] of Object.entries(config.scripts)) {
    tasks.push(
      runOneScript(k, cmd, cwd, outAbs).catch((e) => {
        console.error(`ctx: failed "${k}": ${e instanceof Error ? e.message : String(e)}`);
        process.exitCode = 1;
        throw e;
      }),
    );
  }

  // Wait for all tasks to settle; return only fulfilled paths. [req-concurrent-all]
  const settled = await Promise.allSettled(tasks);
  const created: string[] = [];
  for (const s of settled) {
    if (s.status === 'fulfilled') {
      created.push(s.value);
    }
  }
  return created;
};

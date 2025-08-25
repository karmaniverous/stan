/* src/stan/patch/open.ts
 * Open modified files in an editor based on a configurable command template.
 * Template tokens:
 *   {file}  -> repo-relative path to the modified file
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { cyan, red, yellow } from '@/stan/util/color';

const isDeleted = (cwd: string, rel: string): boolean =>
  !existsSync(path.resolve(cwd, rel));

// In tests, avoid spawning editors which can keep directories locked on Windows.
const isTest = process.env.NODE_ENV === 'test';
const allowOpenInTests = process.env.STAN_FORCE_OPEN === '1';

/**
 * Open modified files in the configured editor.
 *
 * Behavior:
 * - Skips deleted paths.
 * - Skips entirely during tests unless `STAN_FORCE_OPEN=1`.
 * - Spawns detached processes; does not await completion.
 *
 * @param args.cwd Repo root used as the working directory.
 * @param args.files Repo‑relative file paths to open.
 * @param args.openCommand Command template containing `\{file\}` token.
 */
export const openFilesInEditor = (args: {
  cwd: string;
  files: string[];
  openCommand?: string | null | undefined; // e.g., "code -g {file}"
}): void => {
  if (isTest && !allowOpenInTests) return;
  const { cwd, files, openCommand } = args;
  const safeFiles = files.filter((f) => !isDeleted(cwd, f));
  if (!safeFiles.length) return;

  if (!openCommand || !openCommand.includes('{file}')) {
    console.log(
      yellow(
        'stan: no open command configured; run `stan init` and set patchOpenCommand (e.g., "code -g {file}")',
      ),
    );
    return;
  }

  for (const rel of safeFiles) {
    const cmdLine = openCommand.replaceAll('{file}', rel);
    try {
      const child = spawn(cmdLine, {
        cwd,
        shell: true,
        windowsHide: true,
        stdio: 'ignore',
        detached: true,
      });
      child.unref();
      console.log(`stan: open -> ${cyan(rel)}`);
    } catch {
      console.log(
        red(
          `stan: open failed for ${rel}; run \`stan init\` to configure patchOpenCommand`,
        ),
      );
    }
  }
};

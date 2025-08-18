import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

/**
 * @fileoverview Create a project archive under the output directory.
 *
 * @requirements
 * - Default name: `${outputPath}/archive.tar`. [req-archive-name]
 * - Create the output directory if it does not exist. [req-output-dir]
 * - Support including the output directory itself when requested (for "combine"). [req-combine-tar]
 */

export type CreateArchiveOptions = {
  /**
   * When true, include the output directory in the tarball even if it is normally excluded. [req-combine-tar]
   */
  includeOutputDir?: boolean;
  /**
   * Override the output filename. Must end with ".tar". Defaults to "archive.tar". [req-archive-name]
   */
  fileName?: string;
};

/**
 * Create `${outputPath}/archive.tar` (or a custom fileName) using the system tar.
 * Returns the absolute path to the created tar.
 */
export const createArchive = async (
  cwd: string,
  outputPath: string,
  options: CreateArchiveOptions = {},
): Promise<string> => {
  const { includeOutputDir = false, fileName = 'archive.tar' } = options;

  const outDir = path.join(cwd, outputPath);
  if (!existsSync(outDir)) await mkdir(outDir, { recursive: true });

  const dest = path.join(outDir, fileName);

  // Build a tar command that includes repo root (.) and excludes node_modules and (optionally) outputPath.
  // NOTE: We rely on the system 'tar' command; this mirrors npm's agent behavior in CI/dev shells. [req-shell]
  // Cross-platform tar is commonly available on macOS/Linux and Windows (bsdtar). Tests can mock this if needed.
  const args = ['-cf', dest];

  // Exclusions to keep tar size reasonable; tweak as needed for your template.
  args.push('--exclude', 'node_modules');

  if (!includeOutputDir) {
    // Exclude the output directory in the default case to avoid recursion.
    args.push('--exclude', path.join(outputPath, '*'));
  }

  // Archive the entire working directory.
  args.push('.');

  await new Promise<void>((resolve, reject) => {
    const child = spawn('tar', args, { cwd, shell: true, windowsHide: true });
    child.on('close', (code) => { code === 0 ? resolve() : reject(new Error(`tar exited with code ${code ?? -1}`)); });
  });

  return dest;
};

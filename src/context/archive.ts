/**
 * REQUIREMENTS
 * - Always generate an `archive.tar` and place it at `outputPath`. [req-archive-always]
 * - Use `git ls-files -z --cached --others --exclude-standard` to enumerate sources,
 *   excluding anything inside `outputPath`. [req-git-ls]
 * - Create the output directory if it does not exist. [req-output-dir]
 * - Provide an injection seam for tests to supply a file list. [req-test-injection]
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { rename, unlink } from 'node:fs/promises';
import path from 'node:path';

import { create as tarCreate } from 'tar';

import { ensureOutputDir } from './config';

type RunResult = { code: number; stdout: string; stderr: string };

/** Run a command and capture stdio (internal). */
const run = async (cmd: string, args: string[], cwd: string): Promise<RunResult> =>
  new Promise<RunResult>((resolve) => {
    const child = spawn(cmd, args, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    const out: Buffer[] = [];
    const err: Buffer[] = [];

    child.stdout.on('data', (c: Buffer) => out.push(c));
    child.stderr.on('data', (c: Buffer) => err.push(c));
    child.on('close', (code: number | null) => {
      resolve({
        code: code ?? -1,
        stdout: Buffer.concat(out).toString('utf8'),
        stderr: Buffer.concat(err).toString('utf8'),
      });
    });
  });

/** List repo files via git. [req-git-ls] */
export const gitListFiles = async (cwd: string): Promise<string[]> => {
  const { code, stdout, stderr } = await run(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    cwd,
  );
  if (code !== 0) {
    throw new Error(`context: git ls-files failed (${String(code)}). ${stderr}`);
  }
  return stdout.split('\u0000').filter((f) => f.length > 0);
};

export type CreateArchiveOptions = {
  /** Repository root; defaults to `process.cwd()`. */
  cwd?: string;
  /** Destination directory (relative to cwd). */
  outputPath: string;
  /**
   * Optional function to list files (for tests). [req-test-injection]
   * Defaults to `gitListFiles`.
   */
  listFilesFn?: (cwd: string) => Promise<string[]>;
};

/**
 * Create the archive at `<outputPath>/archive.tar`.
 * Returns the absolute archive path and file count.
 */
export const createArchive = async ({
  cwd = process.cwd(),
  outputPath,
  listFilesFn = gitListFiles, // [req-test-injection]
}: CreateArchiveOptions): Promise<{ archivePath: string; fileCount: number }> => {
  const outAbs = await ensureOutputDir(cwd, outputPath);

  const allRel = await listFilesFn(cwd);
  const filesRel = allRel.filter(
    (p) => !p.startsWith(`${outputPath}/`) && existsSync(path.join(cwd, p)),
  );

  const archiveAbs = path.join(outAbs, 'archive.tar');
  const tmpAbs = `${archiveAbs}.tmp`;
  if (existsSync(tmpAbs)) {
    await unlink(tmpAbs);
  }

  await tarCreate(
    { cwd, file: tmpAbs, gzip: false, portable: false, preservePaths: false },
    filesRel,
  );

  await rename(tmpAbs, archiveAbs);

   
  console.log(
    `context: wrote ${path.relative(cwd, archiveAbs)} (${String(filesRel.length)} files)`,
  );

  return { archivePath: archiveAbs, fileCount: filesRel.length };
};

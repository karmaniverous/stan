/* src/stan/patch/file-ops.ts
 * File Ops (pre-ops) parser and executor.
 * Verbs: mv <src> <dest> | rm <path> | rmdir <path> | mkdirp <path>
 * - Repo-relative POSIX paths only; deny absolute and any traversal outside repo root.
 * - Dry-run mode validates constraints without changing the filesystem.
 */
import {
  copyFile,
  mkdir,
  readdir,
  rename,
  rm,
  stat,
  unlink,
} from 'node:fs/promises';
import path from 'node:path';

export type FileOp =
  | { verb: 'mv'; src: string; dest: string }
  | { verb: 'rm'; src: string }
  | { verb: 'rmdir'; src: string }
  | { verb: 'mkdirp'; src: string };

export type FileOpsPlan = { ops: FileOp[]; errors: string[] };

export type OpResult = {
  verb: FileOp['verb'];
  src?: string;
  dest?: string;
  status: 'ok' | 'failed';
  errno?: string;
  message?: string;
};

const toPosix = (p: string): string =>
  p.replace(/\\/g, '/').replace(/^\.\/+/, '');

const isAbsolutePosix = (p: string): boolean => /^[/\\]/.test(p);

const normalizePosix = (p: string): string => {
  // Normalize with posix semantics, then strip trailing slash (except root).
  const norm = path.posix.normalize(toPosix(p));
  return norm === '/' ? norm : norm.replace(/\/+$/, '');
};

/** Ensure a repo-relative path stays within repo root after resolution. */
const resolveWithin = (
  cwd: string,
  rel: string,
): { abs: string; ok: boolean } => {
  const abs = path.resolve(cwd, rel);
  // Hardened prefix check (realpath not needed for normalized, repo-relative inputs).
  const root = path.resolve(cwd) + path.sep;
  const ok = abs === path.resolve(cwd) || abs.startsWith(root);
  return { abs, ok };
};

/** Parse the optional "### File Ops" fenced block from a reply body. */
export const parseFileOpsBlock = (source: string): FileOpsPlan => {
  const ops: FileOp[] = [];
  const errors: string[] = [];

  const hRe = /^###\s+File Ops\s*$/m;
  const hMatch = source.match(hRe);
  if (!hMatch) return { ops, errors }; // no block present

  const start = hMatch.index ?? -1;
  if (start < 0) return { ops, errors };

  // Find opening fence after heading
  const afterHeading = source.slice(start + hMatch[0].length);
  const fenceOpenRe = /^\s*`{3,}.*$/m;
  const openMatch = afterHeading.match(fenceOpenRe);
  if (!openMatch || typeof openMatch.index !== 'number') {
    errors.push('File Ops: missing or invalid fence after heading');
    return { ops, errors };
  }
  const openLine = openMatch[0];
  const openIdx = (openMatch.index ?? 0) + (start + hMatch[0].length);
  const ticks = (openLine.match(/`/g) ?? []).length;
  const closeRe = new RegExp(`^\\\`${'{'}${ticks}{'}'}\\s*$`, 'm');
  const afterOpen = source.slice(openIdx + openLine.length);
  const closeMatch = afterOpen.match(closeRe);
  if (!closeMatch || typeof closeMatch.index !== 'number') {
    errors.push('File Ops: missing closing fence');
    return { ops, errors };
  }
  const bodyStart = openIdx + openLine.length;
  const bodyEnd = bodyStart + closeMatch.index;
  const body = source.slice(bodyStart, bodyEnd);

  const lines = body.split(/\r?\n/);
  let lineNo = 0;
  for (const raw of lines) {
    lineNo += 1;
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(/\s+/);
    const verb = parts[0] as FileOp['verb'];
    const args = parts.slice(1);
    const bad = (msg: string) =>
      errors.push(`File Ops line ${lineNo.toString()}: ${msg}`);

    const needsOne = (ok: boolean) => {
      if (!ok) bad(`expected 1 path, got ${args.length.toString()}`);
    };
    const needsTwo = (ok: boolean) => {
      if (!ok) bad(`expected 2 paths, got ${args.length.toString()}`);
    };

    const normSafe = (p?: string): string | null => {
      if (!p || !p.trim()) return null;
      const posix = normalizePosix(p);
      if (!posix || isAbsolutePosix(posix)) return null;
      if (posix.split('/').some((seg) => seg === '..')) return null;
      return posix;
    };

    switch (verb) {
      case 'mv': {
        needsTwo(args.length === 2);
        if (args.length === 2) {
          const src = normSafe(args[0]);
          const dest = normSafe(args[1]);
          if (!src || !dest) bad('mv: invalid repo-relative path');
          else ops.push({ verb: 'mv', src, dest });
        }
        break;
      }
      case 'rm': {
        needsOne(args.length === 1);
        if (args.length === 1) {
          const src = normSafe(args[0]);
          if (!src) bad('rm: invalid repo-relative path');
          else ops.push({ verb: 'rm', src });
        }
        break;
      }
      case 'rmdir': {
        needsOne(args.length === 1);
        if (args.length === 1) {
          const src = normSafe(args[0]);
          if (!src) bad('rmdir: invalid repo-relative path');
          else ops.push({ verb: 'rmdir', src });
        }
        break;
      }
      case 'mkdirp': {
        needsOne(args.length === 1);
        if (args.length === 1) {
          const src = normSafe(args[0]);
          if (!src) bad('mkdirp: invalid repo-relative path');
          else ops.push({ verb: 'mkdirp', src });
        }
        break;
      }
      default:
        bad(`unknown verb "${verb}"`);
        break;
    }
  }
  return { ops, errors };
};

/** Execute File Ops with safety checks. Returns per-op results and overall ok. */
export const executeFileOps = async (
  cwd: string,
  ops: FileOp[],
  dryRun = false,
): Promise<{ ok: boolean; results: OpResult[] }> => {
  const results: OpResult[] = [];

  const within = (rel: string): { abs: string; ok: boolean } =>
    resolveWithin(cwd, rel);

  for (const op of ops) {
    const res: OpResult = {
      verb: op.verb,
      src: (op as { src?: string }).src,
      dest: (op as { dest?: string }).dest,
      status: 'ok',
    };
    try {
      if (op.verb === 'mv') {
        const { abs: srcAbs, ok: sOK } = within(op.src);
        const { abs: dstAbs, ok: dOK } = within(op.dest);
        if (!sOK || !dOK) throw new Error('path escapes repo root');
        if (!dryRun) await mkdir(path.dirname(dstAbs), { recursive: true });
        // Validate existence constraints
        let srcStat: import('fs').Stats | null = null;
        try {
          srcStat = await stat(srcAbs);
        } catch {
          srcStat = null;
        }
        let dstExists = true;
        try {
          await stat(dstAbs);
        } catch {
          dstExists = false;
        }
        if (!srcStat) throw new Error('source does not exist');
        if (dstExists)
          throw new Error('destination exists (non-overwriting in v1)');
        if (!dryRun) {
          try {
            await rename(srcAbs, dstAbs);
          } catch {
            // Cross-device or other rename failure: fallback to copy+unlink
            await copyFile(srcAbs, dstAbs);
            await unlink(srcAbs).catch(async () => {
              // best-effort cleanup on Windows
              try {
                await rm(srcAbs, { force: true });
              } catch {
                /* ignore */
              }
            });
          }
        }
      } else if (op.verb === 'rm') {
        const { abs, ok } = within(op.src);
        if (!ok) throw new Error('path escapes repo root');
        let st: import('fs').Stats | null = null;
        try {
          st = await stat(abs);
        } catch {
          st = null;
        }
        if (!st) throw new Error('file does not exist');
        if (!st.isFile()) throw new Error('not a file');
        if (!dryRun) await rm(abs, { force: false });
      } else if (op.verb === 'rmdir') {
        const { abs, ok } = within(op.src);
        if (!ok) throw new Error('path escapes repo root');
        let st: import('fs').Stats | null = null;
        try {
          st = await stat(abs);
        } catch {
          st = null;
        }
        if (!st) throw new Error('directory does not exist');
        if (!st.isDirectory()) throw new Error('not a directory');
        const entries = await readdir(abs);
        if (entries.length > 0) throw new Error('directory not empty');
        if (!dryRun) await rm(abs, { recursive: false, force: false });
      } else if (op.verb === 'mkdirp') {
        const { abs, ok } = within(op.src);
        if (!ok) throw new Error('path escapes repo root');
        if (!dryRun) await mkdir(abs, { recursive: true });
      }
      res.status = 'ok';
    } catch (e) {
      res.status = 'failed';
      const msg = e instanceof Error ? e.message : String(e);
      res.message = msg;
    }
    results.push(res);
    if (res.status === 'failed' && !dryRun) break; // stop on first failure in apply mode
  }

  const ok = results.every((r) => r.status === 'ok');
  return { ok, results };
};

/** Persist File Ops results to .stan/patch/.debug/ops.json (best-effort). */
export const writeOpsDebugLog = async (
  cwd: string,
  stanPath: string,
  results: OpResult[],
): Promise<void> => {
  try {
    const debugDir = path.join(cwd, stanPath, 'patch', '.debug');
    await mkdir(debugDir, { recursive: true });
    const file = path.join(debugDir, 'ops.json');
    const body = JSON.stringify({ results }, null, 2);
    await import('node:fs/promises').then(({ writeFile }) =>
      writeFile(file, body, 'utf8'),
    );
  } catch {
    // best-effort
  }
};

/** src/stan/classifier.ts
 * Archive-time classifier:
 * - Exclude binary files from the archive.
 * - Flag large text (by size and/or LOC) without excluding it.
 * - Generate a warnings body for <stanPath>/output/archive.warnings.txt.
 */
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const LARGE_SIZE_BYTES = 1 * 1024 * 1024; // 1 MB
const LARGE_LOC = 3000;

const toPosix = (p: string): string => p.replace(/\\/g, '/');

const loadIsBinaryFn = async (): Promise<
  | ((
      file: string | Buffer,
      opts: unknown,
      cb: (err: unknown, result?: boolean) => void,
    ) => void)
  | null
> => {
  try {
    const anyMod = (await import('istextorbinary')) as unknown as {
      isBinary?: (
        file: string | Buffer,
        opts: unknown,
        cb: (err: unknown, result?: boolean) => void,
      ) => void;
      default?: {
        isBinary?: (
          file: string | Buffer,
          opts: unknown,
          cb: (err: unknown, result?: boolean) => void,
        ) => void;
      };
    };
    const fn = anyMod.isBinary ?? anyMod.default?.isBinary;
    return typeof fn === 'function' ? fn : null;
  } catch {
    return null;
  }
};

const isBinaryPath = async (abs: string): Promise<boolean> => {
  const fn = await loadIsBinaryFn();
  if (!fn) return false;
  return await new Promise<boolean>((resolveP) => {
    try {
      fn(abs, null as unknown as object, (_err, result) =>
        resolveP(Boolean(result)),
      );
    } catch {
      resolveP(false);
    }
  });
};

const countLines = (body: string): number => {
  // Normalize to LF for counting; preserve semantics for callers
  const norm = body.replace(/\r\n/g, '\n');
  if (norm.length === 0) return 0;
  return norm.split('\n').length;
};

export type ArchiveClassification = {
  /** Relative paths to include in the archive (non-binary). */
  textFiles: string[];
  /** Relative paths that were excluded because they are binary. */
  excludedBinaries: Array<{ path: string; size: number }>;
  /** Large text files (flagged, not excluded). */
  largeText: Array<{ path: string; size: number; loc?: number }>;
  /** Ready-to-write body for <stanPath>/output/archive.warnings.txt. */
  warningsBody: string;
};

/** Classify files for archiving and build warnings body. */
export const classifyForArchive = async (
  cwd: string,
  relFiles: string[],
): Promise<ArchiveClassification> => {
  const textFiles: string[] = [];
  const excludedBinaries: Array<{ path: string; size: number }> = [];
  const largeText: Array<{ path: string; size: number; loc?: number }> = [];

  await Promise.all(
    relFiles.map(async (rel) => {
      const posixRel = toPosix(rel);
      const abs = resolve(cwd, rel);
      let s: { size: number } | null = null;
      try {
        s = await stat(abs);
      } catch {
        // Skip paths we cannot stat
        return;
      }
      const size = s?.size ?? 0;

      // Binary?
      let bin = false;
      try {
        bin = await isBinaryPath(abs);
      } catch {
        bin = false;
      }
      if (bin) {
        excludedBinaries.push({ path: posixRel, size });
        return;
      }

      // Text — keep, and flag if large by size/LOC
      textFiles.push(posixRel);
      let loc: number | undefined;
      try {
        // Only read file if size heuristic alone didn't trigger the flag,
        // or if size is reasonably bounded.
        if (size <= LARGE_SIZE_BYTES || size < 5 * LARGE_SIZE_BYTES) {
          const body = await readFile(abs, 'utf8');
          loc = countLines(body);
        }
      } catch {
        // ignore read errors; LOC remains undefined
      }
      const largeBySize = size > LARGE_SIZE_BYTES;
      const largeByLoc = typeof loc === 'number' && loc > LARGE_LOC;
      if (largeBySize || largeByLoc) {
        largeText.push({ path: posixRel, size, loc });
      }
    }),
  );

  // Build warnings body
  const lines: string[] = [];
  if (excludedBinaries.length > 0) {
    lines.push(
      `Binary files excluded from archive (${excludedBinaries.length.toString()}):`,
    );
    for (const b of excludedBinaries) {
      lines.push(`  - ${b.path}  (${b.size.toString()} bytes)`);
    }
    lines.push('');
  }
  if (largeText.length > 0) {
    lines.push(
      `Large text files (included; consider excludes if unwanted) (${largeText.length.toString()}):`,
    );
    for (const t of largeText) {
      const parts = [`  - ${t.path}`, `(${t.size.toString()} bytes)`];
      if (typeof t.loc === 'number') parts.push(`${t.loc.toString()} LOC`);
      lines.push(parts.join(' '));
    }
    lines.push('');
    lines.push(
      `Thresholds: size > ${LARGE_SIZE_BYTES.toString()} bytes or LOC > ${LARGE_LOC.toString()}`,
    );
  }
  if (lines.length === 0) {
    lines.push('No archive warnings.');
  }
  const warningsBody = lines.join('\n') + (lines.length ? '\n' : '');

  return { textFiles, excludedBinaries, largeText, warningsBody };
};

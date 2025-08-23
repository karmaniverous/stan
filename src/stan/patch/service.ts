/* src/stan/patch/service.ts
 * Patch application service (no Commander). The CLI adapter delegates here.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { runGit } from '../snap/git';
import { detectAndCleanPatch } from './clean';
import { resolvePatchContext } from './context';
import { parseUnifiedDiff } from './parse';
import { listRejFiles, moveRejFilesToPatchWorkspace } from './rejects';
import { writePatchDiagnostics } from './run/diagnostics';
import { persistFeedbackAndClipboard } from './run/feedback';
import { applyPatchPipeline } from './run/pipeline';
import { readPatchSource } from './run/source';

const ensureParentDir = async (p: string): Promise<void> => {
  const dir = path.dirname(p);
  try {
    await mkdir(dir, { recursive: true });
  } catch {
    // best-effort
  }
};

const pathsFromPatch = (cleaned: string): string[] => {
  const out: string[] = [];
  const re = /^diff --git a\/(.+?) b\/\1/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned))) {
    const p = m[1]?.trim();
    if (p && !out.includes(p)) out.push(p);
  }
  return out;
};

// Early-input detection helpers
const isFeedbackEnvelope = (s: string): boolean =>
  /^\s*BEGIN[_ ]STAN[_ ]PATCH[_ ]FEEDBACK\b/i.test(s);

const seemsUnifiedDiff = (t: string): boolean =>
  /^diff --git /m.test(t) ||
  (/^---\s+(?:a\/|\S)/m.test(t) &&
    /^\+\+\+\s+(?:b\/|\S)/m.test(t) &&
    /^@@\s+-\d+(?:,\d+)?\s+\+\d+(?:,\d+)?\s+@@/m.test(t));

// Warn if any of the touched files appear staged (index contains them).
const maybeWarnStaged = async (
  cwd: string,
  touchedRel: string[],
): Promise<void> => {
  if (!touchedRel.length) return;
  try {
    const res = await runGit(cwd, ['diff', '--cached', '--name-only', '-z']);
    if (res.code !== 0) return;
    const staged = res.stdout
      .split('\u0000')
      .filter((s) => s.length > 0)
      .map((s) => s.replace(/\\/g, '/'));
    const touched = touchedRel.map((s) => s.replace(/\\/g, '/'));
    const overlap = touched.filter((p) => staged.includes(p));
    if (overlap.length > 0) {
      console.warn(
        `stan: warning: ${overlap.length.toString()} patched file(s) appear staged; STAN does not stage automatically.\n` +
          `      To unstage: git restore --staged ${overlap
            .map((p) => (p.includes(' ') ? `"${p}"` : p))
            .join(' ')}`,
      );
    }
  } catch {
    // best-effort
  }
};

export const runPatch = async (
  cwd0: string,
  inputMaybe?: string,
  opts?: { file?: string | boolean; check?: boolean },
): Promise<void> => {
  const { cwd, stanPath, patchAbs, patchRel } = await resolvePatchContext(cwd0);

  // Resolve and read source (with user-facing log)
  let raw = '';
  try {
    const src = await readPatchSource(
      cwd,
      inputMaybe,
      opts && { file: (opts as { file?: string | boolean }).file },
    );
    if (src.kind === 'clipboard') {
      console.log('stan: patch source: clipboard');
    } else if (src.kind === 'argument') {
      console.log('stan: patch source: argument');
    } else {
      console.log(
        `stan: patch source: file "${(src.filePathRel ?? '').replace(/\\/g, '/')}"`,
      );
    }
    raw = src.raw;
  } catch (e) {
    console.error('stan: failed to read patch source', e);
    return;
  }

  // Detect & clean (unified diff only), tolerant to surrounding prose
  const cleaned = detectAndCleanPatch(raw);
  // Collect touched-file candidates from headers (for diagnostics and staged check)
  const changedFromHeaders = pathsFromPatch(cleaned);

  // Early input sanity checks
  if (isFeedbackEnvelope(cleaned)) {
    console.error(
      'stan: FEEDBACK detected; paste this into your AI to receive a corrected patch.',
    );
    // Ensure terminal status for CLI tests/UX
    console.log('stan: patch failed');
    return;
  }
  if (!seemsUnifiedDiff(cleaned)) {
    console.error(
      'stan: input is not a unified diff; expected headers like "diff --git a/<path> b/<path>" with subsequent "---"/"+++" and "@@" hunks.',
    );
    // Ensure terminal status for CLI tests/UX
    console.log('stan: patch failed');
    return;
  }

  // Write cleaned content to canonical path <stanPath>/patch/.patch (always try before parsing)
  try {
    await ensureParentDir(patchAbs);
    await writeFile(patchAbs, cleaned, 'utf8');
  } catch (e) {
    console.error('stan: failed to write cleaned patch', e);
    return;
  }

  // Parse for strip candidates (must not prevent diagnostics from being written)
  let parsed: ReturnType<typeof parseUnifiedDiff> | null = null;
  try {
    parsed = parseUnifiedDiff(cleaned);
  } catch {
    parsed = null; // proceed with a safe fallback
  }

  console.log(`stan: applying patch "${patchRel}"`);

  const check = Boolean(opts?.check);
  // Track *.rej files created during attempts (pre-snapshot)
  const preRej = await listRejFiles(cwd);
  const { ok, result, js } = await applyPatchPipeline({
    cwd,
    patchAbs,
    cleaned,
    check,
  });

  if (ok) {
    // Warn if any of the patched files appear staged
    const touched =
      js && js.okFiles.length > 0 ? js.okFiles : changedFromHeaders;
    await maybeWarnStaged(cwd, touched);
    console.log(check ? 'stan: patch check passed' : 'stan: patch applied');
    return;
  }

  // Diagnostics bundle — MUST succeed even when parse/jsdiff failed earlier
  try {
    const { attemptsRel, debugRel } = await writePatchDiagnostics({
      cwd,
      patchAbs,
      cleaned,
      result,
      js,
    });
    console.log(
      `stan: wrote patch diagnostics -> ${attemptsRel} (per-attempt logs under ${debugRel}/)`,
    );
  } catch {
    // best-effort
  }

  // FEEDBACK bundle (must still be generated for triage)
  {
    try {
      await persistFeedbackAndClipboard({
        cwd,
        stanPath,
        patchAbs,
        cleaned,
        parsed,
        result,
        js,
        changedFromHeaders,
        check,
      });
    } catch {
      // best-effort
    }
  }

  // Move any new *.rej files into <stanPath>/patch/rejects-<ts>/
  let newRejects: string[] = [];
  try {
    const postRej = await listRejFiles(cwd);
    const preSet = new Set(preRej);
    newRejects = postRej.filter((r) => !preSet.has(r));
    const movedTo = await moveRejFilesToPatchWorkspace(cwd, newRejects);
    if (movedTo) {
      console.log(
        `stan: moved ${newRejects.length.toString()} reject file(s) -> ${movedTo}`,
      );
    }
  } catch {
    // best-effort
  }

  console.log(
    `stan: patch ${check ? 'check failed' : 'failed'} (tried: ${result.tried.join(
      ', ',
    )}, jsdiff ok: ${(js?.okFiles?.length ?? 0).toString()}, failed: ${(js?.failed?.length ?? 0).toString()})`,
  );
};

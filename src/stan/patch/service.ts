/* src/stan/patch/service.ts
 * Patch application service (no Commander). The CLI adapter delegates here.
 */
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { loadConfig } from '../config';
import { detectAndCleanPatch } from './clean';
import { resolvePatchContext } from './context';
import { isFeedbackEnvelope, seemsUnifiedDiff } from './detect';
import { maybeWarnStaged } from './git-status';
import { pathsFromPatch } from './headers';
import { openFilesInEditor } from './open';
import { parseUnifiedDiff } from './parse';
import { listRejFiles, moveRejFilesToPatchWorkspace } from './rejects';
import { writePatchDiagnostics } from './run/diagnostics';
import { persistFeedbackAndClipboard } from './run/feedback';
import { applyPatchPipeline } from './run/pipeline';
import { readPatchSource } from './run/source';
import { ensureParentDir } from './util/fs';

// Early path helper
const fileExists = (cwd: string, rel: string): boolean =>
  existsSync(path.join(cwd, rel));

export const runPatch = async (
  cwd0: string,
  inputMaybe?: string,
  opts?: { file?: string | boolean; check?: boolean },
): Promise<void> => {
  const { cwd, stanPath, patchAbs, patchRel } = await resolvePatchContext(cwd0);

  // Resolve repo config (open command default lives here)
  let patchOpenCommand: string | undefined;
  try {
    const cfg = await loadConfig(cwd);
    patchOpenCommand = cfg.patchOpenCommand;
  } catch {
    patchOpenCommand = undefined;
  }

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
    console.log('stan: patch failed');
    return;
  }
  if (!seemsUnifiedDiff(cleaned)) {
    console.error(
      'stan: input is not a unified diff; expected headers like "diff --git a/<path> b/<path>" with subsequent "---"/"+++" and "@@" hunks.',
    );
    console.log('stan: patch failed');
    return;
  }

  // Write cleaned content to canonical path <stanPath>/patch/.patch
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

    // Open modified files (unless deleted) when not --check
    if (!check) {
      const candidates =
        js && js.okFiles.length > 0 ? js.okFiles : changedFromHeaders;
      const existing = candidates.filter((rel) => fileExists(cwd, rel));
      if (existing.length) {
        await openFilesInEditor({
          cwd,
          files: existing,
          openCommand: patchOpenCommand ?? 'code -g {file}',
        });
      }
    }

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

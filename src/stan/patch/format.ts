// src/stan/patch/format.ts
/**
 * Central formatter for patch failure outputs.
 * - Downstream:
 *   - diff: one line per failed file, blank-line separated when multiple.
 *   - file-ops: quote the original ops block + request unified diffs.
 * - STAN repo:
 *   - diff: identification line + diagnostics envelope (START/END).
 *           Attempts summary: one line per git attempt in cascade order:
 *             “&lt;label&gt;: exit &lt;code&gt;[ — &lt;first stderr line&gt;]”.
 *           Always append concise “jsdiff: &lt;path&gt;: &lt;reason&gt;” lines
 *           when jsdiff ran and reported failures.
 *   - file-ops: “The File Ops patch failed.” + diagnostics envelope containing
 *               parse/exec failures; no action‑request line.
 */

export type FailureContext = 'downstream' | 'stan';
export type FailureKind = 'diff' | 'file-ops';

export type JsReason = { path: string; reason: string };

export type DiffFailureInput = {
  context: FailureContext;
  kind: 'diff';
  targets: string[]; // header-derived or jsdiff failed paths
  // Legacy: last-attempt stderr (kept for back-compat when attempts[] not supplied)
  gitStderr?: string;
  // Optional full attempts capture (preferred)
  attempts?: Array<{
    label: string;
    code: number;
    stderr?: string;
  }>;
  // Js fallback reasons when jsdiff ran
  jsReasons?: JsReason[];
};
export type FileOpsFailureInput = {
  context: FailureContext;
  kind: 'file-ops';
  fileOpsBlock?: string; // downstream quoting
  fileOpsErrors?: string[]; // STAN: parser/exec failures (one per line)
};

export type FailureInput = DiffFailureInput | FileOpsFailureInput;

const NL = '\n';

const fmtDownstreamDiff = (targets: string[]): string => {
  // Emit a single, concise line per failed file and separate multiple
  // files with a blank line. Tests assert that the line ends with
  // "was invalid." and that there is a blank line before the next one.
  const lines = targets.map(
    (p) => `The unified diff patch for file ${p} was invalid.`,
  );
  return lines.join(`${NL}${NL}`) + NL;
};

import { renderAttemptSummary } from './diag/util';

const fmtStanDiff = (
  targets: string[],
  gitStderr?: string,
  js?: JsReason[],
  attempts?: DiffFailureInput['attempts'],
) => {
  const id =
    targets.length > 0
      ? `The unified diff patch for file ${targets[0]} was invalid.`
      : 'The unified diff patch was invalid.';

  let diag = '';
  if (attempts && attempts.length) {
    const attemptLines = renderAttemptSummary(attempts);
    const jsLines =
      js && js.length ? js.map((j) => `jsdiff: ${j.path}: ${j.reason}`) : [];
    diag = [...attemptLines, ...jsLines].join(NL);
  } else {
    // Back‑compat path (no attempts[] provided): include gitStderr (when present)
    // and always include js reasons when available.
    const parts: string[] = [];
    if (gitStderr && gitStderr.length) parts.push(gitStderr);
    if (js && js.length) {
      parts.push(...js.map((j) => `jsdiff: ${j.path}: ${j.reason}`));
    }
    diag = parts.join(NL);
  }

  return [
    id,
    '',
    'START PATCH DIAGNOSTICS',
    diag ?? '',
    'END PATCH DIAGNOSTICS',
    '',
  ].join(NL);
};

const fmtDownstreamFileOps = (block?: string): string => {
  return [
    'The following File Ops patch failed:',
    '',
    block ?? '',
    '',
    'Perform this operation with unified diff patches instead.',
    '',
  ].join(NL);
};

const fmtStanFileOps = (errors?: string[]): string => {
  return [
    'The File Ops patch failed.',
    '',
    'START PATCH DIAGNOSTICS',
    ...(errors && errors.length ? errors : ['']),
    'END PATCH DIAGNOSTICS',
    '',
  ].join(NL);
};

export const formatPatchFailure = (inp: FailureInput): string => {
  if (inp.kind === 'diff') {
    return inp.context === 'downstream'
      ? fmtDownstreamDiff(inp.targets)
      : fmtStanDiff(inp.targets, inp.gitStderr, inp.jsReasons, inp.attempts);
  }
  // file-ops
  return inp.context === 'downstream'
    ? fmtDownstreamFileOps(inp.fileOpsBlock)
    : fmtStanFileOps(inp.fileOpsErrors);
};

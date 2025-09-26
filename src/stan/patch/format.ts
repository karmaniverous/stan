// src/stan/patch/format.ts
/**
 * Central formatter for patch failure outputs.
 * - Downstream: *   - diff: one line per failed file, blank-line separated when multiple.
 *   - file-ops: quote the original ops block + request unified diffs.
 * - STAN repo:
 *   - diff: identification line + diagnostics envelope (START/END) with
 *           verbatim git stderr; if absent and jsdiff ran, include concise
 *           “jsdiff: <path>: <reason>” lines.
 *   - file-ops: “The File Ops patch failed.” + diagnostics envelope containing
 *               parse/exec failures; no action request line.
 */

export type FailureContext = 'downstream' | 'stan';
export type FailureKind = 'diff' | 'file-ops';

export type JsReason = { path: string; reason: string };

export type DiffFailureInput = {
  context: FailureContext;
  kind: 'diff';
  targets: string[]; // header-derived or jsdiff failed paths
  gitStderr?: string; // verbatim from last git attempt
  jsReasons?: JsReason[]; // used only when stderr is empty in STAN repo
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

const fmtStanDiff = (
  targets: string[],
  gitStderr?: string,
  js?: JsReason[],
) => {
  const id =
    targets.length > 0
      ? `The unified diff patch for file ${targets[0]} was invalid.`
      : 'The unified diff patch was invalid.';
  const diag =
    gitStderr && gitStderr.length
      ? gitStderr
      : (js ?? []).map((j) => `jsdiff: ${j.path}: ${j.reason}`).join(NL);

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
      : fmtStanDiff(inp.targets, inp.gitStderr, inp.jsReasons);
  }
  // file-ops
  return inp.context === 'downstream'
    ? fmtDownstreamFileOps(inp.fileOpsBlock)
    : fmtStanFileOps(inp.fileOpsErrors);
};

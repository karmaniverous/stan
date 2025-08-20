/* src/stan/paths.ts
 * Global path mapping for stanPath-based directories.
 * - root: <stanPath>
 * - system: <stanPath>/system
 * - output: <stanPath>/output
 * - diff: <stanPath>/diff
 * - dist: <stanPath>/dist
 * - patch: <stanPath>/patch
 */
import { resolve } from 'node:path';

export type StanDirs = {
  rootRel: string;
  systemRel: string;
  outputRel: string;
  diffRel: string;
  distRel: string;
  patchRel: string;
  rootAbs: string;
  systemAbs: string;
  outputAbs: string;
  diffAbs: string;
  distAbs: string;
  patchAbs: string;
};

const normRel = (p: string): string =>
  p.replace(/\\/g, '/').replace(/^\.\/+/, '');

export const makeStanDirs = (cwd: string, stanPath: string): StanDirs => {
  const rootRel = normRel(stanPath);
  const systemRel = `${rootRel}/system`;
  const outputRel = `${rootRel}/output`;
  const diffRel = `${rootRel}/diff`;
  const distRel = `${rootRel}/dist`;

  const rootAbs = resolve(cwd, rootRel);
  const systemAbs = resolve(cwd, systemRel);
  const outputAbs = resolve(cwd, outputRel);
  const diffAbs = resolve(cwd, diffRel);
  const distAbs = resolve(cwd, distRel);

  return {
    rootRel,
    systemRel,
    outputRel,
    diffRel,
    distRel,
    rootAbs,
    systemAbs,
    outputAbs,
    diffAbs,
    distAbs,
  };
};

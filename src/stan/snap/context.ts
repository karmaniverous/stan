/* src/stan/snap/context.ts
 * Resolve execution context for snap commands (cwd, stanPath, maxUndos).
 */
import path from 'node:path';

import { findConfigPathSync, loadConfig } from '../config';

export const resolveContext = async (
  cwd0: string,
): Promise<{ cwd: string; stanPath: string; maxUndos: number }> => {
  const cfgPath = findConfigPathSync(cwd0);
  const cwd = cfgPath ? path.dirname(cfgPath) : cwd0;
  let cfg: { stanPath: string; maxUndos?: number };
  try {
    const loaded = await loadConfig(cwd);
    cfg = { stanPath: loaded.stanPath, maxUndos: loaded.maxUndos };
  } catch {
    cfg = { stanPath: '.stan', maxUndos: 10 };
  }
  return { cwd, stanPath: cfg.stanPath, maxUndos: cfg.maxUndos ?? 10 };
};

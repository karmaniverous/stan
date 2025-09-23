import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import YAML from 'yaml';

import { assembleSystemMonolith } from './src/stan/system/assemble';

/** * Resolve the repository root (directory containing stan.config.* if present)
 * and the configured stanPath. Falls back to ".stan" then "stan".
 */const resolveRootAndStanPath = async (
  cwd: string,
): Promise<{ root: string; stanPath: string }> => {
  const CONFIG_CANDIDATES = [
    'stan.config.yml',
    'stan.config.yaml',
    'stan.config.json',
  ];

  const findConfigUp = (start: string): string | null => {
    let cur = path.resolve(start);
    const tried = new Set<string>();
    // Ascend until filesystem root
    // Guard against cycles via "tried"
    for (;;) {
      if (tried.has(cur)) break;
      tried.add(cur);
      for (const name of CONFIG_CANDIDATES) {
        const p = path.join(cur, name);
        if (existsSync(p)) return p;
      }
      const parent = path.dirname(cur);
      if (parent === cur) break;
      cur = parent;
    }
    return null;
  };

  const cfgPath = findConfigUp(cwd);
  const root = cfgPath ? path.dirname(cfgPath) : path.resolve(cwd);

  let stanPath = '.stan';
  if (cfgPath) {
    try {
      const raw = await readFile(cfgPath, 'utf8');
      const cfg = cfgPath.endsWith('.json')
        ? (JSON.parse(raw) as { stanPath?: unknown })
        : (YAML.parse(raw) as { stanPath?: unknown });
      const fromCfg =
        typeof cfg?.stanPath === 'string' && cfg.stanPath.trim().length
          ? cfg.stanPath.trim()
          : undefined;
      if (fromCfg) stanPath = fromCfg;
    } catch {
      // best‑effort; keep fallback
    }
  }
  // Secondary fallback to "stan" if someone prefers that layout
  if (!stanPath || !stanPath.trim().length) stanPath = '.stan';
  return { root, stanPath };
};

const headerFor = (stanPath: string): string =>
  `<!-- GENERATED: assembled from ${stanPath}/system/parts; edit parts and run \`npm run gen:system\` -->\n`;

const toLF = (s: string) => s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

/**
 * Assemble <stanPath>/system/parts/*.md (sorted) into <stanPath>/system/stan.system.md.
 * No‑op if the parts directory does not exist or contains no .md files.
 *
 * @returns Absolute path to the target monolith (whether written this run or not).
 */
export const assembleSystemPrompt = async (cwd: string): Promise<string> => {
  const { root, stanPath } = await resolveRootAndStanPath(cwd);

  const sysRoot = path.join(root, stanPath, 'system');
  const partsDir = path.join(sysRoot, 'parts');
  const target = path.join(sysRoot, 'stan.system.md');

  await mkdir(sysRoot, { recursive: true });
  const res = await assembleSystemMonolith(root, stanPath);
  if (res.action === 'skipped-no-parts') {
    const rel = path.relative(root, res.partsDir).replace(/\\/g, '/');
    console.log(`stan: gen-system: skipped (no parts at ${rel})`);
    return res.target;
  }
  if (res.action === 'skipped-no-md') {
    const rel = path.relative(root, partsDir).replace(/\\/g, '/');
    console.log(
      `stan: gen-system: no *.md parts found in ${rel}; leaving monolith as-is`,
    );
    return res.target;
  }
  const rel = path.relative(root, res.target).replace(/\\/g, '/');
  console.log(`stan: gen-system -> ${rel}`);
  return res.target;
};
const main = async (): Promise<void> => {
  try {
    await assembleSystemPrompt(process.cwd());
  } catch (e) {
    // Best-effort; print concise error for CI logs
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`stan: gen-system failed: ${msg}`);
    process.exitCode = 1;
  }
};

// Execute only when invoked directly (e.g., `tsx gen-system.ts`)
const thisHref = pathToFileURL(path.resolve('gen-system.ts')).href;
if (import.meta.url === thisHref) {
  void main();
}
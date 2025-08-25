import { existsSync } from 'node:fs';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const HEADER =
  '<!-- GENERATED: assembled from .stan/system/parts; edit parts and run `npm run gen:system` -->\n';

const toLF = (s: string) => s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

/** Assemble .stan/system/parts/*.md (sorted) into stan.system.md. No-op if no parts exist. */
export const assembleSystemPrompt = async (cwd: string): Promise<string> => {
  const sysRoot = path.join(cwd, '.stan', 'system');
  const partsDir = path.join(sysRoot, 'parts');
  const target = path.join(sysRoot, 'stan.system.md');

  await mkdir(sysRoot, { recursive: true });

  if (!existsSync(partsDir)) {
    // Nothing to do if parts folder hasn't been created yet.
    return target;
  }

  const entries = await readdir(partsDir, { withFileTypes: true });
  const partFiles = entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.md'))
    .map((e) => e.name)
    // numeric/lexicographic order by prefix, then name
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (partFiles.length === 0) {
    // No parts present; leave existing monolith untouched.
    return target;
  }

  const bodies: string[] = [];
  for (const name of partFiles) {
    const abs = path.join(partsDir, name);
    const body = toLF(await readFile(abs, 'utf8')).trimEnd();
    bodies.push(body);
  }
  // Separate parts with exactly one blank line
  const assembled = HEADER + bodies.join('\n\n') + '\n';
  await writeFile(target, assembled, 'utf8');
  console.log(`stan: gen-system -> ${path.relative(cwd, target).replace(/\\/g, '/')}`);
  return target;
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

if (import.meta.url === `file://${path.resolve('gen-system.ts')}`) {
  void main();
}

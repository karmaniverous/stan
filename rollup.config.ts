/** See /stan.project.md for global requirements. */
import aliasPlugin, { type Alias } from '@rollup/plugin-alias';
import commonjsPlugin from '@rollup/plugin-commonjs';
import jsonPlugin from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import terserPlugin from '@rollup/plugin-terser';
import typescriptPlugin from '@rollup/plugin-typescript';
import fs from 'fs-extra';
import path from 'node:path';
import { builtinModules } from 'node:module';
import { fileURLToPath } from 'node:url';
import type {
  InputOptions,
  OutputOptions,
  Plugin,
  RollupOptions,
} from 'rollup';
import dtsPlugin from 'rollup-plugin-dts';

const outputPath = 'dist';

// Path alias @ -> <abs>/src (absolute to avoid module duplication warnings in Rollup)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcAbs = path.resolve(__dirname, 'src');
const aliases: Alias[] = [{ find: '@', replacement: srcAbs }];
const alias = aliasPlugin({ entries: aliases });

// Treat Node built-ins and node: specifiers as external.
// Dependencies are resolved by consumers at runtime; this keeps bundles lean.
const nodeExternals = new Set([
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
]);

const copyDocsPlugin = (dest: string): Plugin => {
  return {
    name: 'stan-copy-docs',
    async writeBundle() {
      const fromA = path.resolve(__dirname, 'stan.system.md');
      const fromB = path.resolve(__dirname, 'stan.project.template.md');
      const toDir = path.resolve(__dirname, dest);
      const toA = path.join(toDir, 'stan.system.md');
      const toB = path.join(toDir, 'stan.project.template.md');
      try {
        await fs.ensureDir(toDir);
        if (await fs.pathExists(fromA)) await fs.copyFile(fromA, toA);
        if (await fs.pathExists(fromB)) await fs.copyFile(fromB, toB);
      } catch {
        // Non-fatal: docs copy is best-effort
      }
    },
  };
};

const makePlugins = (minify: boolean, extras: Plugin[] = []): Plugin[] => {
  const base: Plugin[] = [
    alias,
    nodeResolve({ exportConditions: ['node', 'module', 'default'] }),
    commonjsPlugin(),
    jsonPlugin(),
    typescriptPlugin(),
    ...extras,
  ];
  return minify
    ? [...base, terserPlugin({ format: { comments: false } })]
    : base;
};

const commonInputOptions = (
  minify: boolean,
  extras: Plugin[] = [],
): InputOptions => ({
  plugins: makePlugins(minify, extras),
  onwarn(warning, defaultHandler) {
    // Delegate default handling for now
    defaultHandler(warning);
  },
  external: (id) => nodeExternals.has(id),
});

const outCommon = (dest: string): OutputOptions[] => [
  { dir: `${dest}/mjs`, format: 'esm', sourcemap: false },
  { dir: `${dest}/cjs`, format: 'cjs', sourcemap: false },
];

export const buildLibrary = (dest: string): RollupOptions => ({
  input: 'src/index.ts',
  output: outCommon(dest),
  ...commonInputOptions(
    true,
    // Copy doc assets once from the library config
    [copyDocsPlugin(dest)],
  ),
});

const discoverCliEntries = (): string[] => {
  // Include both the programmatic CLI entry and the launcher.
  const candidates = ['src/cli/stan/index.ts', 'src/cli/stan/stan.ts'];
  return candidates.filter((p) => fs.existsSync(p));
};

export const buildCli = (dest: string): RollupOptions => ({
  input: discoverCliEntries(),
  output: [
    {
      dir: `${dest}/cli`,
      format: 'esm',
      sourcemap: false,
      banner: '#!/usr/bin/env node',
    },
  ],
  ...commonInputOptions(false),
});

export const buildTypes = (dest: string): RollupOptions => ({
  input: 'src/index.ts',
  output: [{ dir: `${dest}/types`, format: 'esm' }],
  plugins: [dtsPlugin()],
});

export default [
  buildLibrary(outputPath),
  buildCli(outputPath),
  buildTypes(outputPath),
];

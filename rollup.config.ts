// rollup.config.ts
/** See /stan.project.md for global requirements. */
import aliasPlugin, { type Alias } from '@rollup/plugin-alias';
import commonjsPlugin from '@rollup/plugin-commonjs';
import jsonPlugin from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import terserPlugin from '@rollup/plugin-terser';
import typescriptPlugin from '@rollup/plugin-typescript';
import fs from 'fs-extra';
import path from 'node:path';
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

const makePlugins = (minify: boolean): Plugin[] => {
  const base: Plugin[] = [
    alias,
    nodeResolve({ exportConditions: ['node', 'module', 'default'] }),
    commonjsPlugin(),
    jsonPlugin(),
    typescriptPlugin(),
  ];
  return minify
    ? [...base, terserPlugin({ format: { comments: false } })]
    : base;
};

const commonInputOptions = (minify: boolean): InputOptions => ({
  plugins: makePlugins(minify),
  onwarn(warning, defaultHandler) {
    // Delegate default handling for now
    defaultHandler(warning);
  },
});

const outCommon: OutputOptions[] = [
  { dir: `${outputPath}/mjs`, format: 'esm', sourcemap: false },
  { dir: `${outputPath}/cjs`, format: 'cjs', sourcemap: false },
];

const buildLibrary = (): RollupOptions => ({
  input: 'src/index.ts',
  output: outCommon,
  ...commonInputOptions(true), // minify library
});

const discoverCliEntries = (): string[] => {
  // Only include CLI entry points, not tests.
  const candidates = ['src/cli/stan/index.ts'];
  return candidates.filter((p) => fs.existsSync(p));
};

const buildCli = (): RollupOptions => ({
  input: discoverCliEntries(),
  output: [
    {
      dir: `${outputPath}/cli`,
      format: 'esm',
      sourcemap: false,
      banner: '#!/usr/bin/env node',
    },
  ],
  ...commonInputOptions(false), // do not minify CLI
});

const buildTypes = (): RollupOptions => ({
  input: 'src/index.ts',
  output: [{ dir: `${outputPath}/types`, format: 'esm' }],
  plugins: [dtsPlugin()],
});

export default [buildLibrary(), buildCli(), buildTypes()];

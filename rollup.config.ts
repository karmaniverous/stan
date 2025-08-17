/**
 * REQUIREMENTS (for this file)
 * - Build library as ESM + CJS + .d.ts (no IIFE). [req-rollup-outputs]
 * - Auto-discover CLI entries in src/cli/* (now includes "ctx"). [req-cli-discovery]
 * - Keep imports sorted and remove unused artifacts per ESLint config. [req-lint]
 */
import { createRequire } from 'node:module';

import aliasPlugin, { type Alias } from '@rollup/plugin-alias';
import commonjsPlugin from '@rollup/plugin-commonjs';
import jsonPlugin from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import terserPlugin from '@rollup/plugin-terser';
import typescriptPlugin from '@rollup/plugin-typescript';
import fs from 'fs-extra';
import type { InputOptions, OutputOptions, RollupOptions } from 'rollup';
import dtsPlugin from 'rollup-plugin-dts';

const require = createRequire(import.meta.url);
const pkg = require('./package.json') as Record<string, unknown>;

const outputPath = 'dist';

const aliases: Alias[] = [];
const alias = aliasPlugin({ entries: aliases });

const commonPlugins = [alias, jsonPlugin(), nodeResolve({ preferBuiltins: true }), commonjsPlugin()];

const typescript = typescriptPlugin({
  tsconfig: './tsconfig.json',
  declaration: true,
  declarationDir: outputPath,
});

const commonInputOptions: InputOptions = {
  plugins: [...commonPlugins, typescript],
  treeshake: true,
};

const commonLibraryOutputs: OutputOptions[] = [
  { dir: `${outputPath}/mjs`, format: 'esm', sourcemap: false, exports: 'named' },
  { dir: `${outputPath}/cjs`, format: 'cjs', sourcemap: false, exports: 'named' },
];

const cliCommands = fs
  .readdirSync('src/cli', { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

const config: RollupOptions[] = [
  // Library (ESM + CJS)
  { ...commonInputOptions, input: 'src/index.ts', output: commonLibraryOutputs },

  // Type declarations
  {
    input: 'src/index.ts',
    plugins: [alias, dtsPlugin()],
    output: [{ file: `${outputPath}/index.d.ts`, format: 'es' }],
  },

  // CLI commands (individual directories under src/cli)
  ...cliCommands.map<RollupOptions>((c) => ({
    ...commonInputOptions,
    input: `src/cli/${c}/index.ts`,
    output: [{ dir: `${outputPath}/cli/${c}`, extend: true, format: 'esm' }],
    plugins: [...commonPlugins, typescript, terserPlugin()],
  })),
];

export default config;

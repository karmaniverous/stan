/** See /requirements.md for global requirements. */
import aliasPlugin, { type Alias } from '@rollup/plugin-alias';
import commonjsPlugin from '@rollup/plugin-commonjs';
import jsonPlugin from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import terserPlugin from '@rollup/plugin-terser';
import typescriptPlugin from '@rollup/plugin-typescript';
import fs from 'fs-extra';
import type { InputOptions, OutputOptions, RollupOptions } from 'rollup';
import dtsPlugin from 'rollup-plugin-dts';

const outputPath = 'dist';

// Path alias @ -> ./src
const aliases: Alias[] = [{ find: '@', replacement: './src' }];
const alias = aliasPlugin({ entries: aliases });

const commonPlugins = [alias, jsonPlugin(), nodeResolve({ preferBuiltins: true }), commonjsPlugin()];
const typescript = typescriptPlugin({ tsconfig: './tsconfig.json' });

const commonInputOptions: InputOptions = { plugins: [...commonPlugins, typescript], treeshake: true };

const commonLibraryOutputs: OutputOptions[] = [
  { dir: `${outputPath}/mjs`, format: 'esm', sourcemap: false, exports: 'named' },
  { dir: `${outputPath}/cjs`, format: 'cjs', sourcemap: false, exports: 'named' }
];

const buildLibrary = (): RollupOptions => ({
  input: 'src/index.ts',
  output: commonLibraryOutputs,
  ...commonInputOptions
});

const discoverCliEntries = (): Record<string, string> => {
  const entries: Record<string, string> = {};
  const cliRoot = 'src/cli';
  if (!fs.pathExistsSync(cliRoot)) return entries;
  const names = fs.readdirSync(cliRoot);
  for (const name of names) {
    const sub = `${cliRoot}/${name}/index.ts`;
    if (fs.pathExistsSync(sub)) {
      entries[`cli/${name}`] = sub;
    }
  }
  return entries;
};

const buildCli = (): RollupOptions => ({
  input: discoverCliEntries(),
  output: [{ dir: `${outputPath}/cli`, format: 'esm', sourcemap: false, banner: '#!/usr/bin/env node' }],
  ...commonInputOptions
});

const buildTypes = (): RollupOptions => ({
  input: 'src/index.ts',
  output: [{ dir: `${outputPath}/types`, format: 'esm' }],
  plugins: [dtsPlugin()]
});

export default [buildLibrary(), buildCli(), buildTypes()];

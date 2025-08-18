/** See /requirements.md for global requirements. */
import eslint from '@eslint/js';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import tsdoc from 'eslint-plugin-tsdoc';
import vitest from 'eslint-plugin-vitest';

const tsconfigRootDir = dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  // Global ignores
  {
    ignores: ['.rollup.cache/**', 'dist/**', 'docs/**', 'node_modules/**', 'coverage/**'],
  },

  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  prettierConfig,

  // Project rules
  {
    files: [
      'src/**/*.{ts,tsx,js,cjs,mjs}',
      'rollup.config.ts',
      'vitest.config.ts',
      'eslint.config.js',
      'tsconfig.json',
      'package.json'
    ],
    languageOptions: {
      parserOptions: { project: './tsconfig.json', tsconfigRootDir }
    },
    plugins: {
      prettier: prettierPlugin,
      'simple-import-sort': simpleImportSort,
      tsdoc,
      vitest
    },
    rules: {
      'prettier/prettier': 'error',
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'tsdoc/syntax': 'warn'
    }
  }
);

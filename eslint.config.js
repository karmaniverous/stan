/** See /stan.project.md for global & cross‑cutting requirements. */
/* eslint-env node */
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import jsonc from 'eslint-plugin-jsonc';
import jsoncParser from 'jsonc-eslint-parser';
import prettierPlugin from 'eslint-plugin-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import tsdoc from 'eslint-plugin-tsdoc';
import vitest from 'eslint-plugin-vitest';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const tsconfigRootDir = dirname(fileURLToPath(import.meta.url));

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  // Base JS
  eslint.configs.recommended,

  // TypeScript (type-aware under src/**)
  ...tseslint.configs.recommendedTypeChecked.map((c) => ({
    ...c,
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: {
      ...c.languageOptions,
      parserOptions: {
        ...c.languageOptions?.parserOptions,
        project: ['./tsconfig.json'],
        tsconfigRootDir,
      },
    },
  })),

  // Project-specific rules for TS
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    plugins: {
      'simple-import-sort': simpleImportSort,
      prettier: prettierPlugin,
      tsdoc,
      vitest,
    },
    rules: {
      // Style & quality
      'prettier/prettier': 'error',
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'tsdoc/syntax': 'warn',

      // Our TS preferences
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
    },
  },

  // Tests
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    plugins: { vitest },
    languageOptions: {
      globals: vitest.environments.env.globals,
    },
  },

  // JSON (no nested extends)
  {
    files: ['**/*.json'],
    languageOptions: { parser: jsoncParser },
    plugins: { jsonc },
    rules: {
      ...(jsonc.configs['recommended-with-json'].rules ?? {}),
    },
  },
];

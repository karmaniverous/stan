/** See /requirements.md for global & cross‑cutting requirements. */
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
  // Ignore common generated/third‑party areas.
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/.rollup.cache/**',
      '**/node_modules/**',
      '**/docs/**'
    ]
  },

  // Base JS rules
  eslint.configs.recommended,

  // Base TS (non type‑aware) rules + house rules
  ...tseslint.configs.recommended.map((c) => ({
    ...c,
    files: ['**/*.{ts,tsx,cts,mts}'],
    languageOptions: {
      ...c.languageOptions,
      parserOptions: { ...(c.languageOptions?.parserOptions ?? {}), tsconfigRootDir }
    },
    plugins: { ...(c.plugins ?? {}), prettier: prettierPlugin, 'simple-import-sort': simpleImportSort, tsdoc }
  })),
  {
    files: ['**/*.{ts,tsx,cts,mts,js,cjs,mjs}'],
    rules: {
      'prettier/prettier': 'error',
      'tsdoc/syntax': 'off',
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error'
    }
  },

  // Type‑aware TS rules only inside src/ (so root utility scripts like archive.ts don't need project service)
  ...tseslint.configs.recommendedTypeChecked.map((c) => ({
    ...c,
    files: ['src/**/*.{ts,tsx,cts,mts}'],
    languageOptions: {
      ...c.languageOptions,
      parserOptions: {
        ...(c.languageOptions?.parserOptions ?? {}),
        tsconfigRootDir,
        projectService: true
      }
    },
    rules: {
      ...(c.rules ?? {}),
      // Relax a common false positive in tests without full type contexts
      '@typescript-eslint/await-thenable': 'off'
    }
  })),

  // Vitest for tests
  {
    files: ['**/*.{test,spec}.{ts,tsx,js}'],
    plugins: { vitest },
    rules: { ...(vitest.configs.recommended.rules ?? {}) },
    languageOptions: {
      globals: vitest.environments.env.globals
    }
  },

  // JSON (no nested extends)
  {
    files: ['**/*.json'],
    languageOptions: { parser: jsoncParser },
    plugins: { jsonc },
    rules: {
      ...(jsonc.configs['recommended-with-json'].rules ?? {})
    }
  }
];

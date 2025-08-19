// src/test/setup.ts
/**
 * Test setup
 * - Avoid Windows EBUSY on rm(tempDir) by ensuring we are not inside the directory being removed.
 *   We reset cwd before and after each test to a neutral location.
 */
import { tmpdir } from 'node:os';

import { afterEach, beforeEach } from 'vitest';

beforeEach(() => {
  try {
    process.chdir(tmpdir());
  } catch {
    // ignore
  }
});

afterEach(() => {
  try {
    process.chdir(tmpdir());
  } catch {
    // ignore
  }
});

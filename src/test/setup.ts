// src/test/setup.ts
/**
 * Test setup
 * - Avoid Windows EBUSY on rm(tempDir) by ensuring we are not inside the directory being removed.
 */
import { tmpdir } from 'node:os';

import { afterEach } from 'vitest';

afterEach(() => {
  try {
    process.chdir(tmpdir());
  } catch {
    // ignore
  }
});

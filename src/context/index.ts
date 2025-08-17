/**
 * REQUIREMENTS
 * - Public surface for programmatic `context` features. [req-export-api]
 */
export { createArchive } from './archive';
export type { ContextConfig, ScriptMap } from './config';
export { ensureOutputDir, loadConfig } from './config';
export { generateWithConfig } from './run';

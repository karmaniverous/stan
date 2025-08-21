/* src/stan/patch/index.ts
 * Public API surface for patch services (no Commander logic).
 * Backward-compat: re-export registerPatch from the CLI.
 */
export { runPatch } from './service';
export { registerPatch } from '@/cli/stan/patch';

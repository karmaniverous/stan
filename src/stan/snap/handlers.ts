/* src/stan/snap/handlers.ts
 * Thin adapter layer — preserves public API for CLI wiring.
 */
export { handleInfo, handleRedo, handleSet, handleUndo } from './history';
export { handleSnap } from './snap-run';

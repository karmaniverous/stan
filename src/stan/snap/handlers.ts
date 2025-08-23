/* src/stan/snap/handlers.ts
 * Thin adapter layer — preserves public API for CLI wiring.
 */
export { handleUndo, handleRedo, handleSet, handleInfo } from './history';
export { handleSnap } from './snap-run';

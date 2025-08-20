/**
 * REQUIREMENTS (current):
 * - Render a help footer listing available script keys from the discovered config.
 * - If config cannot be loaded, return an empty string.
 * - The output should include:
 *   - A heading 'Available script keys:' then a comma-separated list of keys.
 *   - An 'Examples:' block with 'stan run', 'stan run test', 'stan run -s -e <key>' lines.
 *
 * UPDATED:
 * - Do not inject a special 'archive' key; archive is now controlled via -a/--archive.
 * - When STAN_DEBUG=1, log the reason config could not be loaded.
 */
import { loadConfigSync } from './config';

export const renderAvailableScriptsHelp = (cwd: string): string => {
  try {
    const cfg = loadConfigSync(cwd);
    const keys = Object.keys(cfg.scripts);
    if (!keys.length) return '';
    // Pick a safe example key (first configured key if available), else use a placeholder.
    const exampleExcept = keys[0] ?? 'lint';
    return [
      '',
      'Available script keys:',
      `  ${keys.join(', ')}`,
      '',
      'Examples:',
      '  stan run',
      '  stan run test',
      `  stan run -s -e ${exampleExcept}`,
      '',
    ].join('\n');
  } catch (e) {
    if (process.env.STAN_DEBUG === '1') {
      console.error('stan: unable to load config for help footer', e);
    }
    return '';
  }
};

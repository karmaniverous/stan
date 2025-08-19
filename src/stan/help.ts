/**
 * REQUIREMENTS (current):
 * - Render a help footer listing available script keys from the discovered config.
 * - If config cannot be loaded, return an empty string.
 * - The output should include:
 *   - A heading 'Available script keys:' then a comma-separated list of keys.
 *   - An 'Examples:' block with 'stan run', 'stan run test', 'stan run -s -e archive' lines.
 */
import { loadConfigSync } from './config';

export const renderAvailableScriptsHelp = (cwd: string): string => {
  try {
    const cfg = loadConfigSync(cwd);
    const keys = Object.keys(cfg.scripts);
    // Ensure special "archive" is listed
    if (!keys.includes('archive')) keys.push('archive');
    if (!keys.length) return '';
    return [
      '',
      'Available script keys:',
      `  ${keys.join(', ')}`,
      '',
      'Examples:',
      '  stan run',
      '  stan run test',
      '  stan run -s -e archive',
      '',
    ].join('\n');
  } catch {
    return '';
  }
};

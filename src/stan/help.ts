/**
 * REQUIREMENTS (current):
 * - Render a help footer listing available script keys from the discovered config.
 * - If config cannot be loaded, return an empty string.
 * - Output should include:
 *   - 'Available script keys:' + comma-separated list
 *   - 'Examples:' lines
 *
 * UPDATED:
 * - Examples now reflect new flags (-s/-x/-q).
 * - When STAN_DEBUG=1, log the reason config could not be loaded.
 */
import { loadConfigSync } from './config';

export const renderAvailableScriptsHelp = (cwd: string): string => {
  try {
    const cfg = loadConfigSync(cwd);
    const keys = Object.keys(cfg.scripts);
    if (!keys.length) return '';
    const example = keys[0] ?? 'lint';
    return [
      '',
      'Available script keys:',
      `  ${keys.join(', ')}`,
      '',
      'Examples:',
      '  stan run -s',
      `  stan run -s ${example}`,
      `  stan run -q -x ${example}`,
      '',
    ].join('\n');
  } catch (e) {
    if (process.env.STAN_DEBUG === '1') {
      console.error('stan: unable to load config for help footer', e);
    }
    return '';
  }
};

/**
 * REQUIREMENTS
 * - Provide a help-text generator listing available script keys from config. [req-help-scripts]
 */
import { loadConfigSync } from './config';

/**
 * Return a help footer block listing available script keys, or onboarding guidance
 * if the config is missing or has no scripts.
 */
export const renderAvailableScriptsHelp = (cwd: string): string => {
  try {
    const cfg = loadConfigSync(cwd);
    if (!cfg) {
      return ['', 'No ctx.config.json|yml found.', 'Run `ctx init` to create one.', ''].join('\n');
    }
    const keys = Object.keys(cfg.scripts);
    if (keys.length === 0) {
      return [
        '',
        'No script keys found in config.',
        'Run `ctx init` to scaffold a config from package.json.',
        '',
      ].join('\n');
    }
    return [
      '',
      'Available script keys:',
      `  ${keys.join(', ')}`,
      '',
      'Examples:',
      '  ctx <runs all scripts concurrently>',
      '  ctx test',
      '  ctx archive',
      '',
    ].join('\n');
  } catch {
    return '';
  }
};

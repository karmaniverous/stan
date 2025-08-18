/**
 * @file src/context/help.ts
 * Small helper to render a footer listing available script keys.
 *
 * NOTE: Global requirements live in /requirements.md.
 */
import { loadConfigSync } from './config';

/**
 * Return a help footer block listing available script keys, or onboarding guidance
 * if the config is missing or has no scripts.
 */
export const renderAvailableScriptsHelp = (cwd: string): string => {
  try {
    const cfg = loadConfigSync(cwd);
    const keys = Object.keys(cfg.scripts);
    if (!keys.length) {
      return [
        'No stan scripts are configured yet.',
        'Create a stan.config.json|yml at your project root to get started.',
        '',
      ].join('\n');
    }
    return [
      '',
      'Available script keys:',
      `  ${keys.join(', ')}`,
      '',
      'Examples:',
      '  stan',
      '  stan test',
      '  stan -s -e archive',
      '',
    ].join('\n');
  } catch {
    return '';
  }
};

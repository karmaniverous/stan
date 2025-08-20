/** See <stanPath>/system/stan.project.md for global requirements. */

import { buildCli, buildLibrary, buildTypes } from './rollup.config';

const outputPath = '.stan/dist';

export default [
  buildLibrary(outputPath),
  buildCli(outputPath),
  buildTypes(outputPath),
];

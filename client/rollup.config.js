import { createSpaConfig } from '@open-wc/building-rollup';
import merge from 'deepmerge';

const config = createSpaConfig();

export default merge(config, {
  input: './index.html',
  extensions: ['.js', '.mjs', '.ts'],
});

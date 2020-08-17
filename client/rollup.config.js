import { createSpaConfig } from '@open-wc/building-rollup';
import merge from 'deepmerge';

const baseConfig = createSpaConfig();

export default merge(baseConfig, {
  input: './index.html'
});

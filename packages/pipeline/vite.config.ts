import { createWPKLibConfig } from '../../vite.config.base';

export default createWPKLibConfig('@wpkernel/pipeline', {
	index: 'src/index.ts',
	v1: 'src/v1.ts',
});

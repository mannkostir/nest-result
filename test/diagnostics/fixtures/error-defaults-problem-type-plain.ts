import { errorDefaults } from '../../../src/index.js';

export const domainDefaults = errorDefaults({ NotFound: { status: 404, type: 'https://example.com/problems/not-found' } });

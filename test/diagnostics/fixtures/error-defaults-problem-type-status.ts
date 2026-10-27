import { errorDefaults } from '../../../src/index.js';

export const domainDefaults = errorDefaults({
  NotFound: { status: 302, type: 'https://example.com/problems/not-found' },
});

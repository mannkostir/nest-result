import { TaggedError } from '../../../src/index.js';

export class DealNotFound extends TaggedError('DealNotFound')<{ dealId: string }> {}

export class AccessDenied extends TaggedError('AccessDenied') {}

export class TaskNotFound extends TaggedError('TaskNotFound', { family: 'NotFound' })<{ taskId: string }> {}

export class ProjectNotFound extends TaggedError('ProjectNotFound', { family: 'NotFound' }) {}

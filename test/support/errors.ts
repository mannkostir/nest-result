import { TaggedError } from '../../src/index.js';

export class DealNotFound extends TaggedError('DealNotFound')<{ dealId: string; message: string }> {}

export class AccessDenied extends TaggedError('AccessDenied') {}

export class Unavailable extends TaggedError('Unavailable') {}

export class ProjectNotFound extends TaggedError('ProjectNotFound', { family: 'NotFound' }) {}

export class TaskNotFound extends TaggedError('TaskNotFound', { family: 'NotFound' })<{ taskId: string }> {}

export class ProjectArchived extends TaggedError('ProjectArchived') {}

import { errorDefaults, MapErrors } from 'nest-result';

export const domainDefaults = errorDefaults({ NotFound: 404, Conflict: 409 });

export const MapDomainErrors = MapErrors.withDefaults(domainDefaults);

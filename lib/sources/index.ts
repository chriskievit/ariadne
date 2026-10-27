import { githubAdapter } from './github';
import { adoAdapter } from './ado';
import type { SourceAdapter } from './types';

// Server only: the adapters pull in the HTTP clients. Order is SOURCE_KEYS order.
export const SOURCE_ADAPTERS: SourceAdapter[] = [githubAdapter, adoAdapter];

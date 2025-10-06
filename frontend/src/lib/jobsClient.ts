// Compatibility shim for legacy imports: "@/lib/jobsClient"
// Promagen rule: named exports only.

export * from './jobs';
export * from './jobs_admin';
export * from './generate';
export * from './runAcrossProviders';

// Ensure the two common symbols exist as named exports.
export { startGeneration } from './generate';
export { streamJob } from './jobs';



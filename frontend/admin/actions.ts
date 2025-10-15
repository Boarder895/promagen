'use server';

// Minimal types for the admin sync form
export type SyncState = {
  status: 'idle' | 'running' | 'done' | 'error';
  message?: string;
};

// Initial state used by the client form
export const initialSyncState: SyncState = { status: 'idle' };

// Server action (stub). Replace with real logic later.
export async function doSync(_formData?: unknown): Promise<SyncState> {
  // TODO: call your backend /admin/sync, return progress, etc.
  return { status: 'done', message: 'Sync completed (stub).' };
}

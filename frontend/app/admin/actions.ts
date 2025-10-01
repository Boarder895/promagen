"use server";

// Shared state for the admin sync flow
export type SyncState = {
  ok: boolean | null;   // null = not run yet
  message: string;
};

// Exported initial state so server & client agree on shape
export const initialSyncState: SyncState = { ok: null, message: "" };

// Server action: (prevState, formData) => Promise<SyncState>
export async function doSync(
  _prev: SyncState,
  _formData: FormData
): Promise<SyncState> {
  try {
    // Wire your API call here when ready:
    // await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/admin/sync`, { method: "POST" });

    return { ok: true, message: "Sync completed." };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, message: msg };
  }
}



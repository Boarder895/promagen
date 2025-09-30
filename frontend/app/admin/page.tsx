import AdminSyncForm from "./AdminSyncForm";
import { doSync, initialSyncState, type SyncState } from "./actions";

export default function AdminPage() {
  // Pass the exported initial state so client & server are in sync
  return (
    <main className="px-6 py-8 space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
      <AdminSyncForm
        action={doSync as (prev: SyncState, formData: FormData) => Promise<SyncState>}
        initialState={initialSyncState}
      />
    </main>
  );
}

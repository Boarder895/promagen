import ProviderGrid from "@/components/ProviderGrid";
import AdminSyncForm from "./AdminSyncForm";
import { syncAction } from "./actions";

export default function AdminPage() {
  return (
    <main className="max-w-7xl mx-auto py-8">
      <div className="flex items-center justify-between px-4">
        <h1 className="text-2xl font-bold">Admin</h1>
        <AdminSyncForm action={syncAction} />
      </div>
      <ProviderGrid />
    </main>
  );
}

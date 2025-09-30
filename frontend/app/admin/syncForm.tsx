// src/app/admin/syncForm.tsx
"use client";

import { useFormState } from "react-dom";
import { useEffect, useState } from "react";
import { doSync, initialSyncState, type SyncState } from "@/admin/actions";

export default function AdminSyncForm() {
  // Let react-dom infer types; don't add generics here
  const [state, formAction] = useFormState(doSync, initialSyncState);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(state.ok !== null);
  }, [state.ok]);

  return (
    <form action={formAction} className="space-y-3">
      <button className="rounded-lg border px-3 py-2">Run sync</button>

      {visible && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            state.ok ? "border-green-500" : "border-red-500"
          }`}
        >
          <div className="font-medium">{state.ok ? "Success" : "Failed"}</div>
          <div className="opacity-80">{state.message ?? ""}</div>
        </div>
      )}
    </form>
  );
}

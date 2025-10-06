"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { SyncState } from "./actions";

type SyncAction = (prev: SyncState, formData: FormData) => Promise<SyncState>;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-2xl border px-4 py-2 shadow-sm hover:shadow transition disabled:opacity-60"
    >
      {pending ? "Syncingâ€¦" : "Run Sync"}
    </button>
  );
}

export default function AdminSyncForm({
  action,
  initialState,
}: {
  action: SyncAction;
  initialState: SyncState;
}) {
  const [state, formAction] = useFormState(action, initialState);

  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (state.ok !== null) {
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 3000);
      return () => clearTimeout(t);
    }
  }, [state.ok, state.message]);

  return (
    <div className="px-4 space-y-3">
      <form action={formAction}>
        <SubmitButton />
      </form>

      {visible && (
        <div
          className={`mt-3 rounded-2xl px-4 py-2 text-sm border ${
            state.ok ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"
          }`}
        >
          {state.ok ? `âœ… ${state.message || "Sync completed"}` : "âŒ Sync failed"}
        </div>
      )}
    </div>
  );
}






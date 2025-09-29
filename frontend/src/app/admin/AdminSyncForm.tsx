"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { SyncState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-2xl border px-4 py-2 shadow-sm hover:shadow transition disabled:opacity-60"
    >
      {pending ? "Syncing…" : "Run Sync"}
    </button>
  );
}

export default function AdminSyncForm({
  action,
}: {
  action: (state: SyncState, formData: FormData) => Promise<SyncState>;
}) {
  const [state, formAction] = useFormState(action, { ok: null as null | string });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (state.ok !== null) {
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 3000);
      return () => clearTimeout(t);
    }
  }, [state.ok, state.message, state.error]);

  return (
    <div className="px-4">
      <form action={formAction}>
        <SubmitButton />
      </form>

      {visible && (
        <div
          className={[
            "mt-3 rounded-2xl px-4 py-2 text-sm border",
            state.ok ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50",
          ].join(" ")}
        >
          {state.ok
            ? `✅ ${state.message} — ${state.at}`
            : `❌ ${state.error ?? "Sync failed"}`}
        </div>
      )}
    </div>
  );
}

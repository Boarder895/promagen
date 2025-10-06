"use client";

import { doSync, initialSyncState, type SyncState as _SyncState } from "@/admin/actions";
import { useFormState } from "react-dom";
import { useRef } from "react";

export default function SyncForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useFormState(doSync, initialSyncState);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <div className="flex items-center gap-2">
        <button type="submit" className="rounded border px-3 py-2">
          Sync now
        </button>
      </div>

      {state?.message && (
        <p className="text-sm opacity-80">{state.message}</p>
      )}
    </form>
  );
}





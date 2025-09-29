"use server";

export type SyncState = {
  ok: boolean | null;
  message?: string;
  error?: string;
  at?: string;
};

function getBaseUrl() {
  // Prefer explicit site URL if you set it (works locally and on Vercel)
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  // Vercel provides this without protocol
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  // Dev fallback
  const port = process.env.PORT || "3000";
  return `http://localhost:${port}`;
}

export async function syncAction(
  _prev: SyncState,
  _formData: FormData
): Promise<SyncState> {
  try {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/admin/sync`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.ADMIN_TOKEN ?? ""}` },
      cache: "no-store",
    });

    if (!res.ok) {
      let msg = "";
      try {
        const j = await res.json();
        msg = j?.error || "";
      } catch { /* ignore */ }
      return { ok: false, error: msg || `HTTP ${res.status}` };
    }

    const data = await res.json().catch(() => ({}));
    return {
      ok: true,
      message: data?.message ?? "Sync completed.",
      at: data?.timestamp ?? new Date().toISOString(),
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Sync failed" };
  }
}

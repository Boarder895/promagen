// lib/jobs_admin.ts

export type AdminJob = {
  id: string;
  name: string;
  status: "queued" | "running" | "success" | "error";
  startedAt?: string;
  finishedAt?: string;
  details?: string;
};

// Stubbed for now so /admin/jobs compiles and doesn't break other routes.
// Wire this to your real admin API later.
export async function getRecentJobs(take: number = 10): Promise<AdminJob[]> {
  return [];
  // Example for later:
  // const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/admin/jobs?take=${take}`, {
  //   headers: { "X-Admin-Token": process.env.NEXT_PUBLIC_ADMIN_TOKEN! }
  // });
  // if (!res.ok) throw new Error("Failed to fetch jobs");
  // return (await res.json()) as AdminJob[];
}

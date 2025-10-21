// 🚫 Cron disabled in frontend.
// Vercel’s serverless runtime can't run long-lived cron jobs.
// Keep this file as a no-op so imports don't break and TypeScript is happy.

export const CRON_DISABLED = true;

// If/when you want cron, run it in the API service or an external scheduler:
// - Move collectors to your backend (Fly) and schedule via Fly machines, GitHub Actions, or a managed cron.
// - Expose a POST /admin/collectors/run endpoint and trigger it on a schedule.





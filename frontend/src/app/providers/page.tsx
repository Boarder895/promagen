// C:\Users\Proma\Projects\promagen\frontend\src\app\providers\page.tsx
// ============================================================================
// /providers REDIRECT (v10.4.0)
// ============================================================================
// This route used to be a bare unstyled duplicate of /providers/leaderboard
// (`<main className="p-6"><ProvidersTable /></main>`). The styled leaderboard
// page now lives at /providers/leaderboard with full hero, dark theme and
// Footer. /providers redirects there.
// ============================================================================

import { redirect } from 'next/navigation';

export default function ProvidersRedirect(): never {
  redirect('/providers/leaderboard');
}

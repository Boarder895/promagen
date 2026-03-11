// src/app/studio/page.tsx
// ============================================================================
// STUDIO REDIRECT — Routes /studio to homepage
// ============================================================================
// The Studio hub page was removed (v6.0.0). Child routes /studio/library
// (My Prompts) and /studio/playground (Prompt Lab) remain active.
// This redirect catches users who trim the URL back to /studio.
// ============================================================================

import { redirect } from 'next/navigation';

export default function StudioPage() {
  redirect('/');
}

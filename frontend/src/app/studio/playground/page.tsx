// src/app/studio/playground/page.tsx
// ============================================================================
// PROMPT LAB REDIRECT — Routes /studio/playground to /prompt-lab
// ============================================================================
// The Prompt Lab moved from /studio/playground → / (v8.0.0) → /prompt-lab
// (v9.0.0). This redirect catches existing bookmarks, search engine links,
// and any internal references that haven't been updated yet.
//
// v9.0.0: Prompt Lab demoted from / to /prompt-lab; Inspire promoted to /.
// ============================================================================

import { redirect } from 'next/navigation';

export default function PlaygroundRedirect() {
  redirect('/prompt-lab');
}

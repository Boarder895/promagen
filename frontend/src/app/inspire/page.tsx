// src/app/inspire/page.tsx
// ============================================================================
// INSPIRE REDIRECT — Routes /inspire to /
// ============================================================================
// The Inspire content moved to the homepage (/) in v9.0.0. This redirect
// catches existing bookmarks, search engine links, and any internal
// references that haven't been updated yet.
//
// v9.0.0: Inspire promoted to homepage; Prompt Lab moved to /prompt-lab.
// ============================================================================

import { redirect } from 'next/navigation';

export default function InspireRedirect() {
  redirect('/');
}

// src/app/sign-in/[[...sign-in]]/page.tsx
//
// Clerk hosted sign-in page.
// This catch-all route renders Clerk's pre-built SignIn component.
// Styling matches Promagen's dark theme.
//
// v1.1: Mobile fix — uses min-h-full + overflow-y-auto so the Clerk card
// is scrollable when the mobile nav bar reduces available height.
// Desktop: still centered with min-h-dvh (nav bar is hidden at md+).

import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex min-h-full items-center justify-center overflow-y-auto bg-slate-950 py-8 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30">
      <SignIn
        appearance={{
          elements: {
            rootBox: 'mx-auto',
            card: 'bg-slate-900 border border-slate-800 shadow-2xl',
            headerTitle: 'text-slate-50',
            headerSubtitle: 'text-slate-400',
            socialButtonsBlockButton:
              'bg-slate-800 border-slate-700 text-slate-50 hover:bg-slate-700',
            socialButtonsBlockButtonText: 'text-slate-50',
            dividerLine: 'bg-slate-700',
            dividerText: 'text-slate-500',
            formFieldLabel: 'text-slate-300',
            formFieldInput:
              'bg-slate-800 border-slate-700 text-slate-50 placeholder:text-slate-500',
            formButtonPrimary:
              'bg-sky-600 hover:bg-sky-500 text-white font-medium',
            footerActionLink: 'text-sky-400 hover:text-sky-300',
            identityPreviewText: 'text-slate-300',
            identityPreviewEditButton: 'text-sky-400 hover:text-sky-300',
          },
        }}
      />
    </div>
  );
}

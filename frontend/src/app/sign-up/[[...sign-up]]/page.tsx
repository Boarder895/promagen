// src/app/sign-up/[[...sign-up]]/page.tsx
//
// Clerk hosted sign-up page.
// This catch-all route renders Clerk's pre-built SignUp component.
// Styling matches Promagen's dark theme.
//
// v1.1: h-full + overflow-y-auto (same fix as sign-in page).

import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="flex h-full items-center justify-center overflow-y-auto bg-slate-950 py-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30">
      <SignUp
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

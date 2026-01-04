// src/app/sign-in/[[...sign-in]]/page.tsx
//
// Clerk hosted sign-in page.
// This catch-all route renders Clerk's pre-built SignIn component.
// Styling matches Promagen's dark theme.

import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-950">
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

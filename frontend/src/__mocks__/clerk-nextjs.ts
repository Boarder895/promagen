// src/__mocks__/clerk-nextjs.ts
// ============================================================================
// CLERK CLIENT MOCK — Jest stub for @clerk/nextjs
// ============================================================================
// Prevents ESM parse errors from @clerk/backend/dist/runtime/browser/crypto.mjs
// and provides safe no-op stubs for all Clerk client-side exports used in the
// codebase.
//
// Mapped via jest.config.cjs moduleNameMapper:
//   '^@clerk/nextjs$' → '<rootDir>/src/__mocks__/clerk-nextjs.ts'
//
// Authority: test-strategy-plan.md
// ============================================================================

import React from 'react';

// ── Hooks ───────────────────────────────────────────────────────────────────
export const useAuth = () => ({
  isLoaded: true,
  isSignedIn: false,
  userId: null,
  sessionId: null,
  getToken: async () => null,
  signOut: async () => undefined,
});

export const useUser = () => ({
  isLoaded: true,
  isSignedIn: false,
  user: null,
});

export const useClerk = () => ({
  openSignIn: () => undefined,
  openSignUp: () => undefined,
  openUserProfile: () => undefined,
  signOut: async () => undefined,
  session: null,
  user: null,
});

export const useSession = () => ({
  isLoaded: true,
  session: null,
  isSignedIn: false,
});

export const useSignIn = () => ({
  isLoaded: true,
  signIn: null,
  setActive: async () => undefined,
});

export const useSignUp = () => ({
  isLoaded: true,
  signUp: null,
  setActive: async () => undefined,
});

// ── Components ──────────────────────────────────────────────────────────────
export const ClerkProvider = ({ children }: { children: React.ReactNode }) =>
  React.createElement(React.Fragment, null, children);

export const SignInButton = ({ children }: { children?: React.ReactNode }) =>
  React.createElement('button', { 'data-testid': 'clerk-sign-in' }, children ?? 'Sign in');

export const SignUpButton = ({ children }: { children?: React.ReactNode }) =>
  React.createElement('button', { 'data-testid': 'clerk-sign-up' }, children ?? 'Sign up');

export const UserButton = () =>
  React.createElement('div', { 'data-testid': 'clerk-user-button' });

export const SignIn = () =>
  React.createElement('div', { 'data-testid': 'clerk-sign-in-page' });

export const SignUp = () =>
  React.createElement('div', { 'data-testid': 'clerk-sign-up-page' });

export const SignedIn = ({ children }: { children: React.ReactNode }) =>
  React.createElement(React.Fragment, null, children);

export const SignedOut = ({ children }: { children: React.ReactNode }) =>
  React.createElement(React.Fragment, null, children);

export const RedirectToSignIn = () => null;
export const RedirectToSignUp = () => null;

// src/__mocks__/clerk-nextjs-server.ts
// ============================================================================
// CLERK SERVER MOCK — Jest stub for @clerk/nextjs/server
// ============================================================================
// Mapped via jest.config.cjs moduleNameMapper:
//   '^@clerk/nextjs/server$' → '<rootDir>/src/__mocks__/clerk-nextjs-server.ts'
//
// Authority: test-strategy-plan.md
// ============================================================================

export const auth = () => ({
  userId: null,
  sessionId: null,
  getToken: async () => null,
  orgId: null,
  orgRole: null,
  orgSlug: null,
});

export const currentUser = async () => null;

export const clerkClient = () => ({
  users: {
    getUser: async () => null,
    updateUserMetadata: async () => ({}),
    getUserList: async () => ({ data: [], totalCount: 0 }),
  },
});

export const clerkMiddleware = () =>
  function middleware() {
    return undefined;
  };

export const createRouteMatcher = () => () => false;

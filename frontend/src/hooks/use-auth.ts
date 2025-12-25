'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Plan, Session, User } from '@/types/user';

type AuthState = {
  loading: boolean;
  user: User | null;
  plan: Plan;
  refresh: () => void;
  login: (email?: string, plan?: Plan) => Promise<void>;
  logout: () => Promise<void>;
};

export default function useAuth(): AuthState {
  const [loading, setLoading] = useState<boolean>(true);
  const [user, setUser] = useState<User | null>(null);

  const fetchMe = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      const json: { ok: boolean; data?: Session } = await res.json();
      setUser(json.ok ? json.data?.user ?? null : null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMe();
  }, [fetchMe]);

  const login = useCallback(
    async (email?: string, plan?: Plan) => {
      setLoading(true);
      try {
        await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email, plan }),
        });
      } finally {
        await fetchMe();
      }
    },
    [fetchMe],
  );

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      await fetchMe();
    }
  }, [fetchMe]);

  return useMemo(
    () => ({
      loading,
      user,
      plan: user?.plan ?? 'free',
      refresh: fetchMe,
      login,
      logout,
    }),
    [loading, user, fetchMe, login, logout],
  );
}

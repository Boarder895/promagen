'use client';

import { useEffect, useState } from 'react';
import type { Session, User } from '@/types/user';

type State = {
  loading: boolean;
  user: User | null;
  plan: 'free' | 'paid';
  refresh: () => void;
  login: (email?: string, plan?: 'free' | 'paid') => Promise<void>;
  logout: () => Promise<void>;
};

export default function useAuth(): State {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  const fetchMe = async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      const json: { ok: boolean; data?: Session } = await res.json();
      setUser(json.ok ? json.data?.user ?? null : null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMe();
  }, []);

  const login = async (email?: string, plan?: 'free' | 'paid') => {
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
  };

  const logout = async () => {
    setLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      await fetchMe();
    }
  };

  return { loading, user, plan: user?.plan ?? 'free', refresh: fetchMe, login, logout };
}

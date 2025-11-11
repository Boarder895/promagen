'use client';

import useAuth from '@/hooks/useAuth';

export default function ProfileMenu() {
  const { user, plan, logout } = useAuth();

  if (!user) return null;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
      <span className="text-xs text-white/70 font-mono">{user.email ?? user.id}</span>
      <span className="rounded bg-white/10 px-2 py-0.5 text-xs">{plan.toUpperCase()}</span>
      <button className="rounded-xl bg-white/10 px-3 py-1.5 text-xs hover:bg-white/15" onClick={() => logout()}>
        Log out
      </button>
    </div>
  );
}

'use client';

import useAuth from '@/hooks/useAuth';

export default function PlanSelector() {
  const { user, login, logout, plan, loading } = useAuth();

  return (
    <section aria-label="Plan selector" className="card p-4">
      <header className="mb-2">
        <h2 className="text-sm font-semibold text-white">Your plan</h2>
      </header>

      {loading ? (
        <p className="text-white/70 text-sm">Loading…</p>
      ) : user ? (
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm text-white/80">
            Signed in as <span className="font-mono">{user.email ?? user.id}</span> ·{' '}
            <span className="font-semibold">{plan.toUpperCase()}</span>
          </div>
          <div className="flex gap-2">
            <button
              className="rounded-xl bg-white/10 px-3 py-1.5 text-sm hover:bg-white/15"
              onClick={() => login(user.email, 'free')}
            >
              Switch to Free
            </button>
            <button
              className="rounded-xl bg-white/10 px-3 py-1.5 text-sm hover:bg-white/15"
              onClick={() => login(user.email, 'paid')}
            >
              Upgrade to Paid
            </button>
            <button className="rounded-xl bg-white/10 px-3 py-1.5 text-sm hover:bg-white/15" onClick={() => logout()}>
              Log out
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            id="email"
            name="email"
            placeholder="email (optional in demo)"
            className="w-64 rounded-xl bg-black/30 px-3 py-1.5 text-sm outline-none"
          />
          <button
            className="rounded-xl bg-white/10 px-3 py-1.5 text-sm hover:bg-white/15"
            onClick={() => {
              const el = document.getElementById('email') as HTMLInputElement | null;
              const email = el?.value || undefined;
              return login(email, 'free');
            }}
          >
            Continue (Free)
          </button>
          <button
            className="rounded-xl bg-white/10 px-3 py-1.5 text-sm hover:bg-white/15"
            onClick={() => {
              const el = document.getElementById('email') as HTMLInputElement | null;
              const email = el?.value || undefined;
              return login(email, 'paid');
            }}
          >
            Continue (Paid)
          </button>
        </div>
      )}
    </section>
  );
}

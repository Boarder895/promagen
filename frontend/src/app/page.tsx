export default function HomePage() {
  return (
    <section className="grid gap-8">
      <header className="text-center">
        <h1 className="text-5xl font-semibold tracking-tight">
          Image generation platforms, side-by-side.
        </h1>
        <p className="mt-3 text-white/70">
          Desktop & tablet first. App Router only. Ribbon stays put.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4">
        {/* Placeholder for 10x2 “platform leaderboard” tiles */}
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-white/10 p-6 hover:border-white/20 transition"
          >
            <div className="text-lg font-medium">Provider #{i + 1}</div>
            <div className="mt-2 text-sm text-white/60">
              Score ↑↓ | Affiliate: {i % 3 === 0 ? "Enabled" : "—"}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}






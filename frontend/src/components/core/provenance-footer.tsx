'use client';

const short = (s: string) => (s.length > 7 ? s.slice(0, 7) : s);

export default function ProvenanceFooter() {
  const sha = process.env['NEXT_PUBLIC_GIT_SHA'] || process.env['GIT_COMMIT'] || '';
  const run = process.env['NEXT_PUBLIC_CI_RUN_ID'] || '';
  const utc = new Date().toISOString().slice(0, 10);
  const label = ['Build', sha ? short(sha) : 'local', '·', run || 'dev', '·', utc].join(' ');

  return (
    <footer role="contentinfo" className="mt-2 flex items-center justify-between text-[11px] text-white/50">
      <span>{label}</span>
      <a href="/api/health" target="_blank" rel="noreferrer" className="rounded px-2 py-0.5 hover:bg-white/10">
        Health
      </a>
    </footer>
  );
}

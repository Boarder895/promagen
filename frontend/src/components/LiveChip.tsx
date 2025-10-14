import React, { useEffect, useState } from 'react';

type Props = {
  providerId: string;
  updatedSuffix?: string; // e.g., "BST" or "" if you prefer UTC
};

export default function LiveChip({ providerId, updatedSuffix = '' }: Props) {
  const [score, setScore] = useState<number | null>(null);
  const [updated, setUpdated] = useState<string>('');

  useEffect(() => {
    let mounted = true;

    async function fetchScore() {
      const r = await fetch(`/api/live/score?providerId=${providerId}`);
      const j = await r.json();
      if (!mounted || !j.ok) return;
      setScore(j.score);
      if (j.updatedAt) {
        const d = new Date(j.updatedAt);
        setUpdated(
          d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) +
            (updatedSuffix ? ` ${updatedSuffix}` : ''),
        );
      }
    }

    fetchScore();
    const t = setInterval(fetchScore, 60_000); // refresh every 60s
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [providerId, updatedSuffix]);

  if (score == null) {
    return <span className="livechip livechip--loading">Live — …</span>;
  }

  return (
    <span className="livechip">
      Live {score} <span className="livechip__sep">•</span>{' '}
      <span title="Last update">{updated || 'just now'}</span>
      <style jsx>{`
        .livechip {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.875rem;
          line-height: 1;
          padding: 0.25rem 0.5rem;
          border-radius: 999px;
          border: 1px solid rgba(0, 0, 0, 0.08);
          background: rgba(0, 0, 0, 0.04);
        }
        .livechip--loading {
          opacity: 0.7;
        }
        .livechip__sep {
          opacity: 0.5;
        }
      `}</style>
    </span>
  );
}

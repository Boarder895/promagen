import React, { useEffect, useState } from "react";
import ProviderCountryChips from "./ProviderCountryChips";

type LiveScore = {
  ok: boolean;
  providerId: string;
  updatedAt: string;
  score: number | null;
  components?: {
    promagen_usage: number;
    search_pulse: number;
    reddit: number;
    community: number;
    health: number;
  };
};

type Props = {
  providerId: string;
  providerName: string;
  onClose: () => void;
};

export default function PlatformLiveDrawer({ providerId, providerName, onClose }: Props) {
  const [score, setScore] = useState<LiveScore | null>(null);
  const [users, setUsers] = useState<number>(0);
  const [updated, setUpdated] = useState<string>("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      const [s, b] = await Promise.all([
        fetch(`/api/live/score?providerId=${providerId}`).then(r => r.json()),
        fetch(`/api/live/board`).then(r => r.json()),
      ]);
      if (!mounted) return;

      if (s?.ok) {
        setScore(s);
        setUpdated(
          s.updatedAt
            ? new Date(s.updatedAt).toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              })
            : ""
        );
      }
      const row = b?.data?.find((x: any) => x.providerId === providerId);
      setUsers(row?.promagenActiveUsers ?? 0);
    }

    load();
    const t = setInterval(load, 60_000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [providerId]);

  return (
    <div
      className="drawer"
      role="dialog"
      aria-modal="true"
      aria-label={`${providerName} live panel`}
    >
      <div className="hdr">
        <strong>{providerName}</strong>
        <button onClick={onClose} className="x" aria-label="Close">
          ×
        </button>
      </div>

      <div className="grid">
        <div className="card">
          <div className="label">Live on Promagen</div>
          <div className="big">{users}</div>
          <div className="sub">users in last 5 minutes</div>
        </div>

        <div className="card">
          <div className="label">Live Activity Score</div>
          <div className="big">{score?.score ?? "…"}</div>
          <div className="sub">updated {updated || "just now"}</div>
        </div>

        <div className="card col2">
          <div className="label">Breakdown (nowcast)</div>
          <ul className="list">
            <li>
              Promagen usage: <b>{score?.components?.promagen_usage ?? 0}</b>
            </li>
            <li>
              Search pulse (est.): <b>{score?.components?.search_pulse ?? 0}</b>
            </li>
            <li>
              Reddit mentions (est.): <b>{score?.components?.reddit ?? 0}</b>
            </li>
            <li>
              Community (est.): <b>{score?.components?.community ?? 0}</b>
            </li>
            <li>
              Health: <b>{score?.components?.health ?? 0}</b>
            </li>
          </ul>
          <p className="disclaimer">
            “Live on Promagen” is first-party and exact. “Nowcast” components
            are estimated interest signals.
          </p>
        </div>

        <div className="card col2">
          <div className="label">Top countries (last 5 minutes)</div>
          <ProviderCountryChips providerId={providerId} />
        </div>
      </div>

      <style jsx>{`
        .drawer {
          position: fixed;
          top: 0;
          right: 0;
          height: 100vh;
          width: min(480px, 96vw);
          background: #fff;
          box-shadow: -12px 0 32px rgba(0, 0, 0, 0.15);
          display: flex;
          flex-direction: column;
          z-index: 60;
          animation: slide 0.18s ease-out;
        }
        @keyframes slide {
          from {
            transform: translateX(8px);
            opacity: 0.8;
          }
          to {
            transform: none;
            opacity: 1;
          }
        }
        .hdr {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.25rem;
          border-bottom: 1px solid rgba(0, 0, 0, 0.08);
        }
        .x {
          background: none;
          border: none;
          font-size: 1.5rem;
          line-height: 1;
          cursor: pointer;
        }
        .grid {
          padding: 1rem 1.25rem;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          overflow-y: auto;
        }
        .card {
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 0.75rem;
          padding: 0.9rem;
        }
        .col2 {
          grid-column: 1 / -1;
        }
        .label {
          font-size: 0.8rem;
          opacity: 0.7;
          margin-bottom: 0.25rem;
        }
        .big {
          font-size: 2rem;
          font-weight: 700;
        }
        .sub {
          font-size: 0.85rem;
          opacity: 0.7;
        }
        .list {
          margin: 0.25rem 0 0.5rem 1.1rem;
        }
        .disclaimer {
          font-size: 0.75rem;
          opacity: 0.65;
          margin: 0;
        }
      `}</style>
    </div>
  );
}



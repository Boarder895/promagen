import React, { useEffect, useState } from "react";
import FlagBarChip from "./FlagBarChip";

type Row = { country_cc: string; users: number };

function nameOf(cc: string) {
  try {
    const dn = new (Intl as any).DisplayNames(["en-GB"], { type: "region" });
    if (!cc || cc === "ZZ") return "Unknown";
    return dn.of(cc) || cc;
  } catch {
    return cc || "Unknown";
  }
}

export default function GlobalCountryStrip() {
  const [rows, setRows] = useState<Row[]>([]);

  async function load() {
    const r = await fetch("/api/live/geo/aggregate");
    const j = await r.json();
    if (!j?.ok) return;
    const list: Row[] = j.data || [];
    // top 6 keeps it tidy
    setRows(list.slice(0, 6));
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!mounted) return;
      await load();
      const t = setInterval(load, 60_000);
      return () => clearInterval(t);
    })();
    return () => { mounted = false; };
  }, []);

  if (!rows.length) return null;

  const maxUsers = Math.max(...rows.map(r => r.users));

  return (
    <div className="strip" aria-label="Top countries now">
      {rows.map(r => (
        <FlagBarChip
          key={r.country_cc}
          cc={r.country_cc || "ZZ"}
          users={r.users}
          maxUsers={maxUsers}
          name={nameOf(r.country_cc)}
        />
      ))}
      <style jsx>{`
        .strip {
          display: flex;
          flex-wrap: wrap;
          gap: .5rem;
          padding: .5rem .85rem;
          border-bottom: 1px solid rgba(0,0,0,.06);
        }
      `}</style>
    </div>
  );
}

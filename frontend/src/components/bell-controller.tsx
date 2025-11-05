"use client";
import { useEffect, useState } from "react";
import { MARKETS } from "@/data/markets";

type Prefs = {
  enabled: boolean;
  volume: number; // 0..1
  subs: Record<string, boolean>;
  dnd?: { enabled: boolean; start: string; end: string };
};

const defaultPrefs: Prefs = {
  enabled: false,
  volume: 0.6,
  subs: Object.fromEntries(MARKETS.map((m) => [m.id, true])),
  dnd: { enabled: true, start: "22:00", end: "07:00" },
};

export default function BellController() {
  const [prefs, setPrefs] = useState<Prefs>(() => {
    try { return JSON.parse(localStorage.getItem("bell-prefs") || "") as Prefs; }
    catch { return defaultPrefs; }
  });

  useEffect(() => {
    localStorage.setItem("bell-prefs", JSON.stringify(prefs));
  }, [prefs]);

  return (
    <button
      onClick={() => setPrefs((p) => ({ ...p, enabled: !p.enabled }))}
      title={prefs.enabled ? "Disable exchange bells" : "Enable exchange bells"}
      style={{
        position: "fixed",
        right: 16,
        bottom: 56,
        zIndex: 5,
        border: "1px solid rgba(255,255,255,0.15)",
        background: "#0c1218",
        color: "#dce7f0",
        padding: "8px 10px",
        borderRadius: 12,
        fontSize: 13,
        cursor: "pointer",
      }}
    >
      ?? {prefs.enabled ? "On" : "Off"}
    </button>
  );
}





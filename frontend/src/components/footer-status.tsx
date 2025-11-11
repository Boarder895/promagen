"use client";

type Props = { getLastPulse: () => Date | null; dataAgeLabel?: string };

export default function FooterStatus({ getLastPulse, dataAgeLabel }: Props) {
  const last = getLastPulse();
  const lastPulse = last ? last.toISOString().slice(11, 16) + " UTC" : "—";
  return (
    <div className="footer">
      <div>Promagen · v1 · Live Markets · Local Intelligence</div>
      <div className="row">
        <div className="muted">Last Pulse {lastPulse}</div>
        {dataAgeLabel ? <div className="muted"> · {dataAgeLabel}</div> : null}
      </div>
    </div>
  );
}





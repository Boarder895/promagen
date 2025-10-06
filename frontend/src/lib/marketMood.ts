import { DateTime } from "luxon";

export type Session = { openIso: string; closeIso: string };

export function getMarketMoodTint(session: Session) {
  const now = DateTime.now();
  const open = DateTime.fromISO(session.openIso);
  const close = DateTime.fromISO(session.closeIso);
  if (now < open || now > close) return "bg-slate-50";
  const firstHour = open.plus({ hours: 1 });
  const lastHour = close.minus({ hours: 1 });
  if (now <= firstHour) return "bg-emerald-50"; // opening pulse
  if (now >= lastHour) return "bg-rose-50";     // closing wind-down
  return "bg-white";
}


export function nowInTZ(tz: string): Date {
  try { return new Date(new Date().toLocaleString("en-GB", { timeZone: tz })); }
  catch { return new Date(); }
}
export function formatClock(d: Date) {
  const pad = (n:number)=>String(n).padStart(2,"0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}





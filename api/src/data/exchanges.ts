export type ExchangeId =
  | 'tse'|'sse'|'sgx'|'hkex'|'dfm'|'moex'|'xetra'|'epa'
  | 'lse'|'jse'|'asx'|'b3'|'bue'|'tsx'|'nyse'|'nasdaq';

export type ExchangeRow = {
  id: ExchangeId;
  state: 'open' | 'closed' | 'holiday';
  localTime?: string;                       // "13:45"
  nextEventLabel: 'opens' | 'closes' | 'reopens';
  countdown?: string;                       // "02h 15m"
  holiday?: string | null;
};

type Hours = { open: [number, number]; close: [number, number]; days?: number[] };
export const EXCHANGE_HOURS: Record<ExchangeId, Hours> = {
  tse:   { open: [9, 0],  close: [15, 0] },
  sse:   { open: [9, 30], close: [15, 0] },
  sgx:   { open: [9, 0],  close: [17, 0] },
  hkex:  { open: [9, 30], close: [16, 0] },
  dfm:   { open: [10, 0], close: [15, 0], days: [1,2,3,4,5,6] },
  moex:  { open: [10, 0], close: [18, 45] },
  xetra: { open: [9, 0],  close: [17, 30] },
  epa:   { open: [9, 0],  close: [17, 30] },
  lse:   { open: [8, 0],  close: [16, 30] },
  jse:   { open: [9, 0],  close: [17, 0] },
  asx:   { open: [10, 0], close: [16, 0] },
  b3:    { open: [10, 0], close: [17, 30] },
  bue:   { open: [11, 0], close: [17, 0] },
  tsx:   { open: [9, 30], close: [16, 0] },
  nyse:  { open: [9, 30], close: [16, 0] },
  nasdaq:{ open: [9, 30], close: [16, 0] },
};

const tzMap: Record<ExchangeId, string> = {
  tse:'Asia/Tokyo', sse:'Asia/Shanghai', sgx:'Asia/Singapore', hkex:'Asia/Hong_Kong',
  dfm:'Asia/Dubai', moex:'Europe/Moscow', xetra:'Europe/Berlin', epa:'Europe/Paris',
  lse:'Europe/London', jse:'Africa/Johannesburg', asx:'Australia/Sydney',
  b3:'America/Sao_Paulo', bue:'America/Argentina/Buenos_Aires',
  tsx:'America/Toronto', nyse:'America/New_York', nasdaq:'America/New_York',
};

const nowInTz = (tz: string) => new Date(new Date().toLocaleString('en-GB', { timeZone: tz }));

const pad = (n: number) => String(n).padStart(2, '0');

export const demoExchangeStatus = (): ExchangeRow[] => {
  const ids = Object.keys(EXCHANGE_HOURS) as ExchangeId[];
  return ids.map((id) => {
    const tz = tzMap[id];
    const now = nowInTz(tz);
    const day = now.getDay(); // 0..6
    const hours = EXCHANGE_HOURS[id];
    const allowedDays = hours.days ?? [1,2,3,4,5];
    const isHoliday = !allowedDays.includes(day);
    const localTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

    const openDate = new Date(now); openDate.setHours(hours.open[0], hours.open[1], 0, 0);
    const closeDate = new Date(now); closeDate.setHours(hours.close[0], hours.close[1], 0, 0);

    let state: ExchangeRow['state'] = 'closed';
    let nextEventLabel: ExchangeRow['nextEventLabel'] = 'opens';
    let countdown = '—';

    if (isHoliday) {
      state = 'holiday';
      nextEventLabel = 'reopens';
      // find next allowed day at open time
      const next = new Date(now);
      for (let i = 0; i < 7; i++) {
        next.setDate(now.getDate() + i + 1);
        if ((hours.days ?? [1,2,3,4,5]).includes(next.getDay())) {
          next.setHours(hours.open[0], hours.open[1], 0, 0);
          break;
        }
      }
      const ms = +next - +now;
      countdown = msToHhMm(ms);
    } else {
      if (+now < +openDate) {
        state = 'closed';
        nextEventLabel = 'opens';
        countdown = msToHhMm(+openDate - +now);
      } else if (+now >= +openDate && +now < +closeDate) {
        state = 'open';
        nextEventLabel = 'closes';
        countdown = msToHhMm(+closeDate - +now);
      } else {
        state = 'closed';
        nextEventLabel = 'opens';
        const next = new Date(openDate); next.setDate(openDate.getDate() + 1);
        // move to next allowed day
        while (!allowedDays.includes(next.getDay())) next.setDate(next.getDate() + 1);
        const nextOpen = new Date(next); nextOpen.setHours(hours.open[0], hours.open[1], 0, 0);
        countdown = msToHhMm(+nextOpen - +now);
      }
    }

    return { id, state, localTime, nextEventLabel, countdown, holiday: isHoliday ? 'Market holiday' : null };
  });
};

const msToHhMm = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${pad(h)}h ${pad(m)}m`;
};

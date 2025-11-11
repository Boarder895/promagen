import { evaluateExchangeOpenState, type Template } from "@/lib/markets/holiday-detector";

const tmpl: Template = {
  label: "US Cash",
  session: [{ days: "Mon-Fri", open: "09:30", close: "16:00" }],
};

function toTz(dateIso: string) {
  // Simulate an exchange-local time; for unit we use the same Date for tzNow/utcNow
  const d = new Date(dateIso);
  return { tzNow: d, utcNow: d };
}

test("explicit holiday wins", () => {
  const { tzNow, utcNow } = toTz("2025-12-25T14:00:00Z");
  const result = evaluateExchangeOpenState({
    tzNow,
    utcNow,
    template: tmpl,
    detector: { noTickMinutes: 10, stalePriceMinutes: 10, minTradesWindow: 5, validateWeekend: true, recordLearnedClosures: false },
    snapshot: { lastTradeTs: Date.now(), lastQuoteTs: Date.now(), tradesInWindow: 100 },
    explicitHoliday: { date: "2025-12-25", name: "Christmas Day" },
  });
  expect(result.state).toBe("closed-holiday");
});

test("probable holiday if quiet in-session", () => {
  const { tzNow, utcNow } = toTz("2025-06-18T14:00:00Z");
  const result = evaluateExchangeOpenState({
    tzNow,
    utcNow,
    template: tmpl,
    detector: { noTickMinutes: 10, stalePriceMinutes: 10, minTradesWindow: 5, validateWeekend: true, recordLearnedClosures: false },
    snapshot: { lastTradeTs: Date.now() - 60 * 60000, lastQuoteTs: Date.now() - 60 * 60000, tradesInWindow: 0 },
  });
  expect(result.state).toBe("probable-holiday");
});

test("out of hours is closed-out-of-hours", () => {
  const { tzNow, utcNow } = toTz("2025-06-18T03:00:00Z");
  const result = evaluateExchangeOpenState({
    tzNow,
    utcNow,
    template: tmpl,
    detector: { noTickMinutes: 10, stalePriceMinutes: 10, minTradesWindow: 5, validateWeekend: true, recordLearnedClosures: false },
    snapshot: {}
  });
  expect(result.state).toBe("closed-out-of-hours");
});


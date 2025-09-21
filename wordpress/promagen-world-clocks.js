// FRONTEND — WORDPRESS
// promagen-world-clocks.js
// Fetch shared JSON from Next.js and render clocks ordered by sunrise (UTC).

(function () {
  const ENDPOINT = (typeof window !== "undefined" && window.PMG_CLOCKS_ENDPOINT)
    ? window.PMG_CLOCKS_ENDPOINT
    : "https://app.promagen.com/api/world-clocks";

  // NOAA sunrise (simplified)
  const deg2rad = (deg) => (Math.PI * deg) / 180;
  const rad2deg = (rad) => (180 * rad) / Math.PI;
  function dayOfYear(d) {
    const start = Date.UTC(d.getUTCFullYear(), 0, 0);
    const diff = +new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())) - start;
    return Math.floor(diff / 86400000);
  }
  function sunriseUtc(date, lat, lon) {
    const zenith = 90.833;
    const N = dayOfYear(date);
    const lngHour = lon / 15;
    const t = N + ((6 - lngHour) / 24);
    const M = (0.9856 * t) - 3.289;
    let L = M + (1.916 * Math.sin(deg2rad(M))) + (0.020 * Math.sin(2 * deg2rad(M))) + 282.634;
    L = ((L + 360) % 360);
    let RA = rad2deg(Math.atan(0.91764 * Math.tan(deg2rad(L))));
    RA = ((RA + 360) % 360);
    const Lq = Math.floor(L / 90) * 90;
    const RAq = Math.floor(RA / 90) * 90;
    RA = (RA + (Lq - RAq)) / 15;
    const sinDec = 0.39782 * Math.sin(deg2rad(L));
    const cosDec = Math.cos(Math.asin(sinDec));
    const cosH = (Math.cos(deg2rad(zenith)) - (sinDec * Math.sin(deg2rad(lat)))) / (cosDec * Math.cos(deg2rad(lat)));
    if (cosH > 1 || cosH < -1) return null;
    const H = 360 - rad2deg(Math.acos(cosH));
    const Hhours = H / 15;
    const T = Hhours + RA - (0.06571 * t) - 6.622;
    let UT = (T - lngHour) % 24;
    if (UT < 0) UT += 24;
    const y = date.getUTCFullYear(), m = date.getUTCMonth(), d = date.getUTCDate();
    const hh = Math.floor(UT);
    const mm = Math.floor((UT - hh) * 60);
    const ss = Math.round((((UT - hh) * 60) - mm) * 60);
    return new Date(Date.UTC(y, m, d, hh, mm, ss));
  }

  function fmtTime(d, tz) {
    return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(d);
  }
  function fmtDate(d, tz) {
    return new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", day: "2-digit", month: "short", year: "numeric" }).format(d);
  }
  function fmtSunriseLocal(srUtc, tz) {
    if (!srUtc) return "—";
    return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(srUtc);
  }

  const rootSel = "[data-pmg-world-clocks]";
  const gridSel = "[data-pmg-grid]";

  async function loadCities() {
    try {
      const r = await fetch(ENDPOINT, { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      if (!json || !Array.isArray(json.cities)) throw new Error("Bad payload");
      return json.cities;
    } catch (e) {
      console.error("World clocks fetch failed:", e);
      // Fallback minimal list (stays in sync if endpoint is down)
      return [
        { id: "london", name: "London", timeZone: "Europe/London", lat: 51.5074, lon: -0.1278, flag: "🇬🇧" },
        { id: "dubai",  name: "Dubai",  timeZone: "Asia/Dubai",    lat: 25.2048, lon: 55.2708, flag: "🇦🇪" },
      ];
    }
  }

  function render(cities) {
    const root = document.querySelector(rootSel);
    const grid = document.querySelector(gridSel);
    if (!root || !grid) return;

    const now = new Date();
    const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const ordered = cities.map((c) => {
      const sr = sunriseUtc(base, c.lat, c.lon);
      return { ...c, srUtc: sr, sortKey: sr ? sr.getTime() : Number.POSITIVE_INFINITY };
    }).sort((a, b) => a.sortKey - b.sortKey);

    grid.innerHTML = "";
    ordered.forEach((c) => {
      const card = document.createElement("div");
      card.className = "pmg-clock";

      const name = document.createElement("div");
      name.className = "pmg-clock__name";
      name.innerHTML = `<span class="pmg-clock__flag" aria-hidden="true">${c.flag || "🕒"}</span>${c.name}`;

      const time = document.createElement("div");
      time.className = "pmg-clock__time";
      time.textContent = fmtTime(now, c.timeZone);

      const date = document.createElement("div");
      date.className = "pmg-clock__date";
      date.textContent = fmtDate(now, c.timeZone);

      const meta = document.createElement("div");
      meta.className = "pmg-clock__meta";
      meta.innerHTML = `<span>Sunrise: ${fmtSunriseLocal(c.srUtc, c.timeZone)}</span><span>TZ: ${c.timeZone}</span>`;

      card.appendChild(name);
      card.appendChild(time);
      card.appendChild(date);
      card.appendChild(meta);
      grid.appendChild(card);
    });
  }

  let citiesCache = null;

  async function init() {
    citiesCache = await loadCities();
    render(citiesCache);
    setInterval(() => render(citiesCache), 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();



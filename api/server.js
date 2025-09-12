const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const auth = require("basic-auth");

const app = express();

// --- config ---
const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "https://app.promagen.com")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);
const BASIC_AUTH_USER = process.env.BASIC_AUTH_USER || "";
const BASIC_AUTH_PASS = process.env.BASIC_AUTH_PASS || "";

// --- middleware ---
app.disable("x-powered-by");
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(express.json());
app.use(morgan("tiny"));
app.use(cors({
  origin(origin, cb) {
    // allow server-to-server/no-origin and any whitelisted origins
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error("CORS blocked"));
  },
  credentials: true
}));

// Optional: protect all routes with Basic Auth if creds provided
if (BASIC_AUTH_USER && BASIC_AUTH_PASS) {
  app.use((req, res, next) => {
    const creds = auth(req);
    if (creds && creds.name === BASIC_AUTH_USER && creds.pass === BASIC_AUTH_PASS) return next();
    res.set("WWW-Authenticate", 'Basic realm="Promagen API"');
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  });
}

// --- health + sample routes ---
app.get("/health", (req, res) => {
  res.json({ ok: true, service: "promagen-api", time: new Date().toISOString() });
});

app.get("/ready", (req, res) => {
  // add DB checks later if needed
  res.json({ ready: true });
});

app.get("/v1/ping", (req, res) => {
  res.json({ pong: true });
});

// root info
app.get("/", (req, res) => {
  res.json({
    name: "Promagen API",
    endpoints: ["/health", "/ready", "/v1/ping"],
    allowed_origins: ALLOWED_ORIGINS
  });
});

// error handler (last)
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: "Internal error" });
});

app.listen(PORT, () => {
  console.log(`Promagen API listening on ${PORT}`);
});

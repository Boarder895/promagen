"use strict";
/**
 * Promagen API — Express server (versioned)
 * - Root infra:   /health (200 OK), /metrics (text)
 * - Versioned API: /api/v1/* (feature routers)
 * - Prompts:      /api/v1/prompts
 * - Status:       /api/v1/status (read-only info)
 * - Admin:        /api/v1/admin (stub)
 * - Binds 0.0.0.0:${PORT} (8080 on Fly)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = exports.logger = void 0;
var express_1 = require("express");
var cors_1 = require("cors");
var pino_1 = require("pino");
// Routers & middleware
var routes_1 = require("./routes");
var metrics_1 = require("./middleware/metrics");
var error_1 = require("./middleware/error");
// ---------- Logger (stdout by default; optional Logtail) ----------
function createLogger() {
    var level = process.env.LOG_LEVEL || "info";
    var hasLogtail = !!process.env.LOGTAIL_SOURCE_TOKEN;
    if (hasLogtail) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            var transport = pino_1.default.transport({
                target: "@logtail/pino",
                options: {
                    sourceToken: process.env.LOGTAIL_SOURCE_TOKEN,
                    host: process.env.LOGTAIL_INGEST_HOST
                }
            });
            return (0, pino_1.default)({ level: level }, transport);
        }
        catch (err) {
            // eslint-disable-next-line no-console
            console.warn("[logger] @logtail/pino not available; using stdout:", (err === null || err === void 0 ? void 0 : err.message) || err);
        }
    }
    return (0, pino_1.default)({ level: level });
}
exports.logger = createLogger();
// ---------- App ----------
exports.app = (0, express_1.default)();
// Core middleware
exports.app.use(express_1.default.json({ limit: "1mb" }));
exports.app.use(express_1.default.urlencoded({ extended: false }));
exports.app.use((0, cors_1.default)({
    origin: true, // tighten later
    credentials: false
}));
// Tiny request logger
exports.app.use(function (req, res, next) {
    var t0 = process.hrtime.bigint();
    res.on("finish", function () {
        var ms = Number(process.hrtime.bigint() - t0) / 1000000;
        exports.logger.info({ method: req.method, url: req.url, statusCode: res.statusCode, durationMs: Math.round(ms) }, "http");
    });
    next();
});
// ---------- Infra (root) ----------
exports.app.get("/health", function (_req, res) { return res.status(200).send("OK"); });
exports.app.get("/metrics", metrics_1.metricsHandler);
// Optional root JSON
exports.app.get("/", function (_req, res) {
    res.status(200).json({
        name: "Promagen API",
        status: "ok",
        uptimeSec: Math.round(process.uptime()),
        nowIso: new Date().toISOString(),
        api: { v1: "/api/v1" }
    });
});
// ---------- Versioned API ----------
exports.app.use("/api/v1", routes_1.v1Router);
// ---------- Error handler ----------
exports.app.use(error_1.errorHandler);
// ---------- Listen ----------
var port = Number(process.env.PORT) || 8080;
if (require.main === module) {
    exports.app.listen(port, "0.0.0.0", function () {
        exports.logger.info({ port: port }, "Server listening");
    });
}
exports.default = exports.app;

"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpLogger = void 0;
var pino_1 = require("pino");
/**
 * Safe transport builder for Better Stack (Logtail).
 * - If LOGTAIL_SOURCE_TOKEN is missing OR pino.transport doesn't exist,
 *   we fall back to stdout so the app never crashes.
 */
function makeTransport() {
    var sourceToken = process.env.LOGTAIL_SOURCE_TOKEN;
    if (!sourceToken)
        return undefined;
    var hasTransport = typeof pino_1.default.transport === "function";
    if (!hasTransport)
        return undefined;
    var endpoint = process.env.LOGTAIL_INGEST_HOST; // optional (from Source page: "Ingesting host")
    try {
        return pino_1.default.transport({
            target: "@logtail/pino",
            options: __assign({ sourceToken: sourceToken }, (endpoint ? { endpoint: endpoint } : {})),
        });
    }
    catch (_a) {
        // If transport target fails to load at runtime, just skip it.
        return undefined;
    }
}
var transport = makeTransport();
var logger = (0, pino_1.default)({
    level: (_a = process.env.LOG_LEVEL) !== null && _a !== void 0 ? _a : "info",
    base: {
        service: "promagen-api",
        env: (_b = process.env.NODE_ENV) !== null && _b !== void 0 ? _b : "production",
        region: process.env.FLY_REGION,
    },
    redact: ["authorization", "password", "token", "cookies", "x-api-key"],
}, transport // undefined -> stdout; defined -> Logtail transport
);
// Lightweight request logger (avoids pino-http typing fuss)
var httpLogger = function (req, _res, next) {
    logger.info({ method: req.method, url: req.url }, "request");
    next();
};
exports.httpLogger = httpLogger;
exports.default = logger;

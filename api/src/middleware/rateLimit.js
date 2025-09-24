"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimit = rateLimit;
var store = new Map();
function rateLimit(opts) {
    var _a, _b;
    var windowMs = Math.max(1000, opts.windowMs);
    var max = Math.max(1, opts.max);
    var keyFn = (_a = opts.key) !== null && _a !== void 0 ? _a : (function (req) { var _a; return (_a = req.ip) !== null && _a !== void 0 ? _a : "anonymous"; });
    var H = ((_b = opts.headerPrefix) !== null && _b !== void 0 ? _b : "X-RateLimit-").replace(/[^A-Za-z-]/g, "");
    return function (req, res, next) {
        var _a;
        var key = keyFn(req);
        var now = Date.now();
        var b = (_a = store.get(key)) !== null && _a !== void 0 ? _a : { count: 0, resetAt: now + windowMs };
        if (now >= b.resetAt) {
            b.count = 0;
            b.resetAt = now + windowMs;
        }
        b.count += 1;
        store.set(key, b);
        res.setHeader("".concat(H, "Limit"), String(max));
        res.setHeader("".concat(H, "Remaining"), String(Math.max(0, max - b.count)));
        res.setHeader("".concat(H, "Reset"), String(Math.floor(b.resetAt / 1000)));
        if (b.count > max) {
            return res.status(429).json({
                ok: false,
                error: "RATE_LIMITED",
                message: "Too many requests; try again after ".concat(Math.ceil((b.resetAt - now) / 1000), "s"),
                requestId: req.requestId,
            });
        }
        next();
    };
}

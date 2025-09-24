"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
function errorHandler(err, _req, res, _next) {
    var status = typeof (err === null || err === void 0 ? void 0 : err.status) === "number" ? err.status : 500;
    var msg = (err && (err.message || err.toString())) || "Internal Server Error";
    // Log to stdout; swap for a central logger later if desired.
    // eslint-disable-next-line no-console
    console.error("[error]", { status: status, msg: msg, stack: err === null || err === void 0 ? void 0 : err.stack });
    res.status(status).json({ error: status === 500 ? "Internal Server Error" : msg });
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metricsHandler = metricsHandler;
function metricsHandler(_req, res, _next) {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.status(200).send("# metrics temporarily disabled\n");
}

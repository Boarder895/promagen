"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var router = (0, express_1.Router)();
/**
 * Read-only API status & info
 * GET /api/v1/status
 */
router.get("/", function (_req, res) {
    res.json({
        name: "Promagen API",
        version: "v1",
        uptimeSec: Math.round(process.uptime()),
        nowIso: new Date().toISOString()
    });
});
exports.default = router;

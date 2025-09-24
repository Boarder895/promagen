"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var router = (0, express_1.Router)();
/**
 * Admin (stub) — we'll add guards later.
 */
router.get("/ping", function (_req, res) {
    res.json({ ok: true, t: Date.now() });
});
exports.default = router;

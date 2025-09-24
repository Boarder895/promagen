"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/openai.ts — stub so build succeeds
var express_1 = require("express");
var router = (0, express_1.Router)();
router.post("/chat", function (req, res) {
    var _a;
    res.json({ ok: true, echo: (_a = req.body) !== null && _a !== void 0 ? _a : null });
});
exports.default = router;

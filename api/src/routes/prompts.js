"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var prompts_1 = require("../data/prompts");
var counters_1 = require("../store/counters");
var router = (0, express_1.Router)();
/**
 * GET /prompts
 * Optional filters: ?q=search&tag=xyz
 * Only uses fields that actually exist in our Prompt type (title, body, tags).
 */
router.get("/", function (_req, res) {
    res.json(prompts_1.default);
});
router.get("/search", function (req, res) {
    var q = String(req.query.q || "").trim().toLowerCase();
    var tag = String(req.query.tag || "").trim().toLowerCase();
    var list = prompts_1.default;
    if (q) {
        list = list.filter(function (p) {
            var inTitle = p.title.toLowerCase().includes(q);
            var inBody = p.body.toLowerCase().includes(q);
            var inTags = (p.tags || []).some(function (t) { return t.toLowerCase().includes(q); });
            return inTitle || inBody || inTags;
        });
    }
    if (tag) {
        list = list.filter(function (p) { return (p.tags || []).map(function (t) { return t.toLowerCase(); }).includes(tag); });
    }
    res.json(list);
});
/**
 * POST /prompts/:id/use — increment "uses"
 * POST /prompts/:id/like — increment "likes"
 * POST /prompts/:id/remix — increment "remixes"
 */
router.post("/:id/use", function (req, res) {
    var id = String(req.params.id);
    var result = (0, counters_1.useCount)(id);
    res.json(result);
});
router.post("/:id/like", function (req, res) {
    var id = String(req.params.id);
    var result = (0, counters_1.like)(id);
    res.json(result);
});
router.post("/:id/remix", function (req, res) {
    var id = String(req.params.id);
    var result = (0, counters_1.remix)(id);
    res.json(result);
});
/** GET /prompts/stats — snapshot of counters */
router.get("/stats", function (_req, res) {
    res.json((0, counters_1.snapshot)());
});
exports.default = router;

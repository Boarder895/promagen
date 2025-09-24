"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
// src/app.ts
var express_1 = require("express");
var helmet_1 = require("helmet");
var cors_1 = require("cors");
var logger_1 = require("./middleware/logger");
function createApp() {
    var app = (0, express_1.default)();
    // Casts ensure Express picks the correct .use() overloads
    app.use((0, helmet_1.default)());
    app.use(express_1.default.json());
    app.use((0, cors_1.default)());
    app.use(logger_1.httpLogger);
    // Minimal routes so the service is functional
    app.get("/health", function (_req, res) { return res.status(200).send("ok"); });
    app.get("/metrics", function (_req, res) { return res.type("text/plain").send("# metrics\n"); });
    app.get("/scores", function (_req, res) { return res.json({ scores: [] }); });
    return app;
}

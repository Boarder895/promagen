"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.v1Router = void 0;
/**
 * v1Router aggregates all v1 feature routers.
 */
var express_1 = require("express");
var prompts_1 = require("./prompts");
var status_1 = require("./status");
var admin_1 = require("./admin");
exports.v1Router = (0, express_1.Router)();
exports.v1Router.use("/prompts", prompts_1.default);
exports.v1Router.use("/status", status_1.default);
exports.v1Router.use("/admin", admin_1.default);
exports.default = exports.v1Router;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storeKeySchema = void 0;
// src/lib/validation.ts
var zod_1 = require("zod");
exports.storeKeySchema = zod_1.z.object({
    provider: zod_1.z.enum(["artistly", "openai", "stability", "leonardo"]),
    apiKey: zod_1.z.string().min(10).max(200),
});



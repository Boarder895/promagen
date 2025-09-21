// BACKEND • API • Type augmentation for req.log
// File: api/src/types/express.d.ts
import "express";
import type { Logger } from "pino";

declare module "http" {
  interface IncomingMessage {
    log: Logger;
    id?: string;
  }
}

declare module "express-serve-static-core" {
  interface Request {
    log: Logger;
    id?: string;
  }
}


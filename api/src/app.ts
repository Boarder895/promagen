// src/app.ts
import express, { type Express, type RequestHandler } from "express";
import helmet from "helmet";
import cors from "cors";
import { httpLogger } from "./middleware/logger";

export function createApp(): Express {
  const app: Express = express();

  // Casts ensure Express picks the correct .use() overloads
  app.use(helmet() as RequestHandler);
  app.use(express.json() as unknown as RequestHandler);
  app.use(cors() as RequestHandler);
  app.use(httpLogger as unknown as RequestHandler);

  // Minimal routes so the service is functional
  app.get("/health", (_req, res) => res.status(200).send("ok"));
  app.get("/metrics", (_req, res) => res.type("text/plain").send("# metrics\n"));
  app.get("/scores", (_req, res) => res.json({ scores: [] }));

  return app;
}


// BACKEND
import { Router } from "express";
const r = Router();

// Simple model listing; expand later per provider
r.get("/models", (_req, res) => {
  res.json({
    ok: true,
    models: [
      { provider: "openai", id: "gpt-4o-mini", type: "chat" }
    ]
  });
});

export default r;



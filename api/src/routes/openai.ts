// src/routes/openai.ts — stub so build succeeds
import { Router, type Request, type Response } from "express";
const router = Router();

router.post("/chat", (req: Request, res: Response) => {
  res.json({ ok: true, echo: req.body ?? null });
});

export default router;


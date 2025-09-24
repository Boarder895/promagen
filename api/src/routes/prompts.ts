import { Router } from "express";
import { prisma } from "../db/prisma.js";

const router = Router();

/**
 * GET /api/v1/prompts
 * List all prompts
 */
router.get("/", async (_req, res) => {
  const prompts = await prisma.prompt.findMany();
  res.json(prompts);
});

/**
 * POST /api/v1/prompts
 * Create a new prompt
 */
router.post("/", async (req, res) => {
  const { title, text, tagsJson, provider, author } = req.body;

  try {
    const prompt = await prisma.prompt.create({
      data: {
        title,
        text,
        tagsJson,
        provider,
        author,
      },
    });
    res.status(201).json(prompt);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

export default router;

import { Router } from 'express';
// import { prisma } from '../lib/prisma';  // Uncomment + use when your model is ready.

const router = Router();

router.get('/scores', async (_req, res) => {
  // Example shape; adapt to your real model:
  // const scores = await prisma.score.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  const scores = [{ id: 1, user: 'demo', value: 42, createdAt: new Date().toISOString() }];
  res.json({ items: scores });
});

export default router;




import { Router, type Request, type Response } from 'express';
import { prisma } from '../prisma';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ ok: true });
});

router.get('/health/db', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ db: 'ok' });
  } catch (err) {
    res.status(500).json({ db: 'down', error: (err as Error).message });
  }
});

export default router;




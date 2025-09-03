import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// Health
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// Create or update a platform
app.post('/platforms', async (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name required' });
  const p = await prisma.platform.upsert({
    where: { name },
    update: {},
    create: { name },
  });
  res.json(p);
});

// List platforms
app.get('/platforms', async (_req, res) => {
  const list = await prisma.platform.findMany({ orderBy: { name: 'asc' } });
  res.json(list);
});

// Parse PORT safely as a number
const port = parseInt(process.env.PORT ?? '4000', 10);

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});


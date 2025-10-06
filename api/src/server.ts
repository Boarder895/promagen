// src/server.ts
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pino from 'pino';

// Your existing handlers
import { health } from './routes/health';
import { getProvidersRoute } from './routes/providers';
import { getMarketsRoute } from './routes/markets';

const PORT = Number(process.env.PORT ?? 3001);
const HOST = '0.0.0.0';

const app = express();
const log = pino({ level: process.env.LOG_LEVEL ?? 'info' });

// Security & basics
app.use(helmet());
app.use(
  cors({
    origin: [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://promagen.com',
      'https://www.promagen.com',
      'https://app.promagen.com',
    ],
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));

// Infra
app.get('/health', health);
app.get('/metrics', (_req, res) => {
  res.type('text/plain').send('promagen_up 1\n');
});

// --- Feature routes (keep existing) ---
app.get('/api/v1/providers', getProvidersRoute);
app.get('/api/v1/markets', getMarketsRoute);

// --- NEW: aliases expected by the frontend UI ---
// Providers board expects /api/v1/providers/scores
app.get('/api/v1/providers/scores', getProvidersRoute);

// Exchanges board expects /api/v1/exchanges/status
app.get('/api/v1/exchanges/status', getMarketsRoute);

// Start server
app.listen(PORT, HOST, () => {
  log.info(`API listening on http://${HOST}:${PORT}`);
});

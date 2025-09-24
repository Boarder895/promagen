// src/app.ts
import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors, { CorsOptions } from 'cors';

// ----- CORS allow-list from env (comma-separated) -----
const allowList = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const corsOptions: CorsOptions = {
  origin(origin, cb) {
    // allow non-browser tools with no Origin header (curl, fly health, etc.)
    if (!origin) return cb(null, true);
    if (allowList.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
};

// ----- App -----
const app = express();

app.set('trust proxy', 1);          // correct client IPs behind Fly's proxy
app.disable('x-powered-by');

// Security + parsing
app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cors(corsOptions));

// Health probe
app.get('/health', (_req, res) => res.status(200).send('OK'));

// ----- Routes -----
// IMPORTANT: keep the .js in relative imports with node16/nodenext
import echoRouter from './routes/echo.js';
app.use('/v1/echo', echoRouter);

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.path });
});

// Error handler
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : 'Internal Server Error';
  res.status(500).json({ error: message });
});

export default app;









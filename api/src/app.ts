import express, { type Request, type Response } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const app = express();

/**
 * Behind Fly's proxy, enable this so req.ip is the real client IP.
 * (Needed for accurate rate limiting.)
 */
app.set('trust proxy', 1);

/**
 * Security headers.
 * Helmet’s defaults are safe and won’t break an API.
 * We’re not enabling CSP since this is a JSON API; we can add it later
 * when we know the exact front-end origins.
 */
app.use(helmet());

/**
 * Global rate limit: 100 requests per minute per IP.
 * Skip health so Fly’s checks never trigger 429.
 * Standard/legacy headers make observability friendly.
 */
const limiter = rateLimit({
  windowMs: 60 * 1000,        // 1 minute
  max: 100,                   // 100 req/min/IP
  standardHeaders: true,      // RateLimit-* headers
  legacyHeaders: false,       // disable X-RateLimit-*
  skip: (req) => req.path === '/health'
});
app.use(limiter);

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health endpoint (used by Fly checks and your sanity pings)
app.get('/health', (_req: Request, res: Response) => res.status(200).send('OK'));

export default app;







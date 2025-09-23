import express, { type Request, type Response } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors, { type CorsOptions } from 'cors';

const app = express();

// Behind Fly's proxy so req.ip is correct (needed for rate limit)
app.set('trust proxy', 1);

/**
 * SECURITY HEADERS
 * For an API, keep CSP minimal; other Helmet protections stay on.
 */
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        // API doesn’t serve HTML assets; make this very tight.
        defaultSrc: ["'none'"],
        connectSrc: ["'self'"], // browsers loading API docs, if any
        frameAncestors: ["'none'"],
        baseUri: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false // APIs don’t need COEP and it can break fetchers
  })
);

/**
 * CORS
 * Allow only the origins you specify via CORS_ORIGINS (comma-separated).
 * Falls back to localhost:3000 for dev.
 * We allow no credentials; if you later need cookies, flip `credentials: true`.
 */
const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const corsOptions: CorsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);            // curl/Postman
    return cb(null, allowedOrigins.includes(origin));
  },
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
  maxAge: 600
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // preflight

/**
 * RATE LIMIT
 * Skip health so Fly’s check never trips 429.
 */
const limiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health'
});
app.use(limiter);

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health for Fly + sanity pings
app.get('/health', (_req: Request, res: Response) => res.status(200).send('OK'));

export default app;








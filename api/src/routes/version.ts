import { Router } from 'express';
import pkg from '../../package.json'; // works because tsconfig has "resolveJsonModule": true

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    name: pkg.name,
    version: pkg.version,
    env: process.env.NODE_ENV || 'development'
  });
});

export default router;


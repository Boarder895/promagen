import { Router } from 'express';
import { demoExchangeStatus } from '../../data/exchanges';

export const exchangesRouter = Router();

exchangesRouter.get('/status', (_req, res) => {
  const rows = demoExchangeStatus();
  res.json(rows);
});

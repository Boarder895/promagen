import { Router } from 'express';
import { demoProviderScores } from '../../data/providers';

export const providersRouter = Router();

providersRouter.get('/scores', (_req, res) => {
  const rows = demoProviderScores();
  res.json(rows);
});

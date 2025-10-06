import { Router, type Request, type Response } from 'express';

export const apiRouter = Router();

apiRouter.get('/ping', (_: Request, res: Response) => {
  res.json({ pong: true, ts: Date.now() });
});

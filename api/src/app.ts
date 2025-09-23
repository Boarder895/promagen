import express, { type Request, type Response } from 'express';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req: Request, res: Response) => res.status(200).send('OK'));

export default app;







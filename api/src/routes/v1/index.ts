import { Router } from 'express';
import { providersRouter } from './providers';
import { exchangesRouter } from './exchanges';

export const v1Router = Router();

v1Router.use('/providers', providersRouter);
v1Router.use('/exchanges', exchangesRouter);

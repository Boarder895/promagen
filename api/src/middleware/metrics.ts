import type { Request, Response, NextFunction } from 'express';
import {
  Registry,
  collectDefaultMetrics,
  Histogram,
  Counter
} from 'prom-client';

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 4]
});
registry.registerMetric(httpRequestDuration);

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});
registry.registerMetric(httpRequestsTotal);

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const end = httpRequestDuration.startTimer({
    method: req.method,
    route: req.route?.path || req.path
  });

  res.on('finish', () => {
    const labels = {
      method: req.method,
      route: req.route?.path || req.path,
      status_code: String(res.statusCode)
    };
    httpRequestsTotal.inc(labels);
    end({ status_code: String(res.statusCode) });
  });

  next();
}

export async function metricsHandler(_req: Request, res: Response) {
  res.set('Content-Type', registry.contentType);
  res.end(await registry.metrics());
}



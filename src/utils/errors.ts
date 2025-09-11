// Basic HTTP error helpers
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const badRequest   = (m = "Bad Request")   => new HttpError(400, m);
export const unauthorized = (m = "Unauthorized")  => new HttpError(401, m);
export const forbidden    = (m = "Forbidden")     => new HttpError(403, m);
export const notFound     = (m = "Not Found")     => new HttpError(404, m);

export function toErrorResponse(err: unknown): { status: number; body: any } {
  if (err instanceof HttpError) {
    return { status: err.status, body: { ok: false, error: err.message } };
  }
  const msg = (err as any)?.message ?? String(err);
  return { status: 500, body: { ok: false, error: msg } };
}

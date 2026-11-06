import type { ErrorRequestHandler } from "express";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, `Invalid id: ${value}`);
  }
  return id;
}

function statusOf(err: unknown): number {
  if (err instanceof HttpError) return err.status;
  // body-parser errors (e.g. malformed JSON) carry their own 4xx status
  if (typeof err === "object" && err !== null && "status" in err && typeof err.status === "number") {
    return err.status;
  }
  return 500;
}

export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
  const status = statusOf(err);
  if (status >= 500) console.error(err);
  const message = status >= 500 || !(err instanceof Error) ? "Internal server error" : err.message;
  res.status(status).json({ error: message });
};

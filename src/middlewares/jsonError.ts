import { Request, Response, NextFunction } from 'express';

export function jsonError(err: any, _req: Request, res: Response, next: NextFunction) {
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'invalid_json', details: err.message });
  }
  return next(err);
}

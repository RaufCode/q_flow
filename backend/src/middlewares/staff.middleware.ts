import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth.middleware.js';

export function requireCounterStaff(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'COUNTER_STAFF') {
    res.status(403).json({ error: 'Forbidden: Counter staff access required.' });
    return;
  }
  next();
}
import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { loginUser, bindShift, unbindShift } from '../services/auth.service.js';
import { getSafeErrorMessage } from '../utils/errorHandler.js';

export async function handleLogin(req: Request, res: Response): Promise<void> {
  try {
    const { employeeId, password } = req.body;
    if (!employeeId || !password) {
      res.status(400).json({ error: 'Employee ID and password are required.' });
      return;
    }

    const result = await loginUser(employeeId, password);
    res.status(200).json(result);
  } catch (error: any) {
    console.error('Login failed:', error);
    res.status(401).json({ error: getSafeErrorMessage(error, 'Authentication failed.') });
  }
}

export async function handleBindShift(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const { counterId } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Not authenticated.' });
      return;
    }

    if (!counterId) {
      res.status(400).json({ error: 'counterId is required.' });
      return;
    }

    const counter = await bindShift(userId, counterId);
    res.status(200).json({ message: 'Shift successfully bound.', counter });
  } catch (error: any) {
    console.error('Bind shift failed:', error);
    res.status(400).json({ error: getSafeErrorMessage(error, 'Failed to bind shift.') });
  }
}

export async function handleUnbindShift(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated.' });
      return;
    }

    const result = await unbindShift(userId);
    res.status(200).json(result);
  } catch (error: any) {
    console.error('Unbind shift failed:', error);
    res.status(400).json({ error: getSafeErrorMessage(error, 'Failed to unbind shift.') });
  }
}
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import {
  listCounters,
  getCurrentTicketForCounter,
  getQueueForCounter,
  callNextTicketByEmployeeId,
  skipTicket,
  markTicketInService,
  markTicketServed,
  updateTicketStatus,
  recallTicket,
  getStaffShiftOverview,
} from '../services/staff.service.js';
import { getSafeErrorMessage } from '../utils/errorHandler.js';

// GET /api/counters
export async function handleListCounters(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const counters = await listCounters();
    res.status(200).json({ counters });
  } catch (error: any) {
    console.error('List counters failed:', error);
    res.status(400).json({ error: getSafeErrorMessage(error, 'Failed to load counters.') });
  }
}

// GET /api/staff/counters/:employeeId/current-ticket
export async function handleGetCurrentTicket(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { employeeId } = req.params;
    if (typeof employeeId !== 'string') {
      res.status(400).json({ error: 'Invalid counter identifier.' });
      return;
    }

    const ticket = await getCurrentTicketForCounter(employeeId);
    res.status(200).json({ ticket });
  } catch (error: any) {
    console.error('Get current ticket failed:', error);
    res.status(400).json({ error: getSafeErrorMessage(error, 'Failed to load current ticket.') });
  }
}

// GET /api/staff/counters/:employeeId/queue
export async function handleGetQueue(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { employeeId } = req.params;
    if (typeof employeeId !== 'string') {
      res.status(400).json({ error: 'Invalid counter identifier.' });
      return;
    }

    const tickets = await getQueueForCounter(employeeId);
    res.status(200).json({ tickets });
  } catch (error: any) {
    console.error('Get queue failed:', error);
    res.status(400).json({ error: getSafeErrorMessage(error, 'Failed to load queue.') });
  }
}

// POST /api/staff/counters/:employeeId/call-next
export async function handleCallNext(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { employeeId } = req.params;
    if (typeof employeeId !== 'string') {
      res.status(400).json({ error: 'Invalid counter identifier.' });
      return;
    }

    const result = await callNextTicketByEmployeeId(employeeId);
    res.status(200).json({ ticket: result.ticket });
  } catch (error: any) {
    console.error('Call next failed:', error);
    res.status(400).json({ error: getSafeErrorMessage(error, 'Failed to call next customer.') });
  }
}

// PATCH /api/staff/tickets/:id/status
export async function handleUpdateTicketStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const staffId = req.user?.userId;

    if (typeof id !== 'string') {
      res.status(400).json({ error: 'Invalid ticket ID.' });
      return;
    }
    if (typeof status !== 'string') {
      res.status(400).json({ error: 'Status is required.' });
      return;
    }

    const ticket = await updateTicketStatus(id, status, staffId);
    res.status(200).json({ message: 'Ticket status updated.', ticket });
  } catch (error: any) {
    console.error('Update ticket status failed:', error);
    res.status(400).json({ error: getSafeErrorMessage(error, 'Failed to update ticket status.') });
  }
}

// POST /api/staff/tickets/:id/recall
export async function handleRecallTicket(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (typeof id !== 'string') {
      res.status(400).json({ error: 'Invalid ticket ID.' });
      return;
    }

    const ticket = await recallTicket(id);
    res.status(200).json({ message: 'Customer re-notified.', ticket });
  } catch (error: any) {
    console.error('Recall ticket failed:', error);
    res.status(400).json({ error: getSafeErrorMessage(error, 'Failed to recall ticket.') });
  }
}

// POST /api/staff/tickets/:id/start  (kept — not currently called by the dashboard)
export async function handleStartService(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const staffId = req.user?.userId;

    if (typeof id !== 'string') {
      res.status(400).json({ error: 'Invalid ticket ID.' });
      return;
    }
    if (!staffId) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const ticket = await markTicketInService(id, staffId);
    res.status(200).json({ message: 'Service started.', ticket });
  } catch (error: any) {
    console.error('Start service failed:', error);
    res.status(400).json({ error: getSafeErrorMessage(error, 'Failed to start service.') });
  }
}

// POST /api/staff/tickets/:id/skip  (kept — not currently called by the dashboard)
export async function handleSkipTicket(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const staffId = req.user?.userId;

    if (typeof id !== 'string') {
      res.status(400).json({ error: 'Invalid ticket ID.' });
      return;
    }
    if (!staffId) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const ticket = await skipTicket(id, staffId);
    res.status(200).json({ message: 'Ticket skipped.', ticket });
  } catch (error: any) {
    console.error('Skip ticket failed:', error);
    res.status(400).json({ error: getSafeErrorMessage(error, 'Failed to skip ticket.') });
  }
}

// GET /api/staff/shift-overview  (kept — not currently called by the dashboard)
export async function handleGetShiftOverview(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const staffId = req.user?.userId;
    if (!staffId) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const overview = await getStaffShiftOverview(staffId);
    res.status(200).json(overview);
  } catch (error: any) {
    console.error('Get shift overview failed:', error);
    res.status(400).json({ error: getSafeErrorMessage(error, 'Failed to retrieve shift overview.') });
  }
}
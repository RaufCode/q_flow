import type { Request, Response } from 'express';
import { createTicket, cancelCustomerTicket, getTicketStatus } from '../services/ticket.service.js';

const VALID_CHANNELS = ['WHATSAPP', 'SMS', 'NONE'] as const;
type NotificationChannel = (typeof VALID_CHANNELS)[number];

function getSafeErrorMessage(error: unknown, fallback: string): string {
  // Only trust messages from errors we deliberately threw ourselves.
  // Anything else (Prisma internals, unexpected exceptions) gets hidden from the client.
  if (error instanceof Error && !error.message.toLowerCase().includes('prisma')) {
    return error.message;
  }
  return fallback;
}

/**
 * POST /api/tickets/check-in
 * Customer checks into the queue
 */
export async function handleCheckIn(req: Request, res: Response): Promise<void> {
  try {
    const { customerName, phoneNumber, preferredChannel } = req.body;

    if (!customerName || !phoneNumber) {
      res.status(400).json({ error: 'Customer name and phone number are required.' });
      return;
    }

    if (preferredChannel !== undefined && !VALID_CHANNELS.includes(preferredChannel)) {
      res.status(400).json({
        error: `Invalid preferredChannel. Must be one of: ${VALID_CHANNELS.join(', ')}.`,
      });
      return;
    }

    const ticket = await createTicket({
      customerName,
      phoneNumber,
      preferredChannel: preferredChannel as NotificationChannel | undefined,
    });
    res.status(201).json({ message: 'Check-in successful', ticket });
  } catch (error: any) {
    console.error('Check-in failed:', error);
    res.status(500).json({ error: getSafeErrorMessage(error, 'Failed to process check-in.') });
  }
}

// GET /api/v1/tickets/:id/status
export async function handleGetTicketStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (typeof id !== 'string') {
      res.status(400).json({ error: 'Invalid ticket ID parameter.' });
      return;
    }

    const ticket = await getTicketStatus(id);
    res.status(200).json({ ticket });
  } catch (error: any) {
    console.error('Get ticket status failed:', error);
    res.status(404).json({ error: getSafeErrorMessage(error, 'Ticket not found.') });
  }
}

// POST /api/v1/tickets/:id/cancel
export async function handleCancelTicket(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (typeof id !== 'string') {
      res.status(400).json({ error: 'Invalid ticket ID parameter.' });
      return;
    }

    const ticket = await cancelCustomerTicket(id);
    res.status(200).json({
      message: 'Your ticket has been successfully cancelled.',
      ticket,
    });
  } catch (error: any) {
    console.error('Cancel ticket failed:', error);
    res.status(400).json({ error: getSafeErrorMessage(error, 'Failed to cancel ticket.') });
  }
}
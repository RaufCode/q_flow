import { prisma } from '../config/db.js';
import { TicketStatus } from '@qflow/database/client';
import { broadcastQueueEvent, SOCKET_EVENTS } from '../sockets/queue.socket.js';
import {logNotification} from '../utils/lognotification.js';

/**
 * 2. Ticket Service Functions
 */

//----------------Join Queue (Customer check-in)--------------
export function sanitizeCustomerName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, ' ');

  if (trimmed.length < 2 || trimmed.length > 100) {
    throw new Error('Customer name must be between 2 and 100 characters.');
  }

  // Letters (any language), spaces, apostrophes, hyphens, periods only
  if (!/^[\p{L}\s.'-]+$/u.test(trimmed)) {
    throw new Error('Customer name contains invalid characters.');
  }

  return trimmed;
}

export function sanitizePhoneNumber(phone: string): string {
  const digitsOnly = phone.replace(/[^\d]/g, '');

  // Normalize to 233XXXXXXXXX (Ghana country code, no leading +/0)
  let normalized: string;
  if (digitsOnly.length === 10 && digitsOnly.startsWith('0')) {
    normalized = `233${digitsOnly.slice(1)}`;
  } else if (digitsOnly.length === 12 && digitsOnly.startsWith('233')) {
    normalized = digitsOnly;
  } else if (digitsOnly.length === 9) {
    normalized = `233${digitsOnly}`;
  } else {
    throw new Error(
      'Invalid phone number. Expected a Ghanaian number, e.g. 0241234567 or 233241234567.'
    );
  }

  return normalized;
}

export async function createTicket(data: {
  customerName: string;
  phoneNumber: string;
  preferredChannel?: 'WHATSAPP' | 'SMS' | 'NONE';
}) {
  const customerName = sanitizeCustomerName(data.customerName);
  const phoneNumber = sanitizePhoneNumber(data.phoneNumber);

  // Generate daily ticket sequence number (e.g., "A-001")
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const countToday = await prisma.ticket.count({
    where: {
      joinedAt: { gte: todayStart },
    },
  });

  const ticketNumber = `A-${String(countToday + 1).padStart(3, '0')}`;

  // Calculate current waiting count for position and EWT
  const waitingCount = await prisma.ticket.count({
    where: { status: 'WAITING' },
  });

  const position = waitingCount + 1;
  const estimatedWaitTimeMinutes = position * 3; // Approx 3 mins per ticket

  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber,
      customerName,
      phoneNumber,
      preferredChannel: data.preferredChannel || 'WHATSAPP',
      status: TicketStatus.WAITING,
      initialPosition: position,
      currentPosition: position,
      estimatedWaitTimeMinutes,
    },
  });

  // Log initial join notification event
  await logNotification(
    ticket.id,
    ticket.preferredChannel,
    'INITIAL_JOIN',
    `Your ticket ${ticketNumber} is confirmed. Initial position: ${position}.`,
    ticket.phoneNumber
  );

  return ticket;
}


//-------------Get Live Ticket Status for Customer View--------------

export async function getTicketStatus(ticketId: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      ticketNumber: true,
      customerName: true,
      status: true,
      currentPosition: true,
      estimatedWaitTimeMinutes: true,
      skipCount: true,
      counter: {
        select: {
          counterNumber: true,
          counterName: true,
        },
      },
    },
  });

  if (!ticket) {
    throw new Error('Ticket not found.');
  }

  return ticket;
}

//-------------Customer Self-Cancellation--------------
export async function cancelCustomerTicket(ticketId: string) {
  const cancelledTicket = await prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.findUnique({ where: { id: ticketId } });

    if (!ticket) {
      throw new Error('Ticket not found.');
    }

    if (ticket.status !== TicketStatus.WAITING && ticket.status !== TicketStatus.CALLED) {
      throw new Error('Only WAITING or CALLED tickets can be cancelled.');
    }

    const updated = await tx.ticket.update({
      where: { id: ticketId },
      data: {
        status: TicketStatus.CANCELLED,
        cancelledAt: new Date(),
        currentPosition: 0,
      },
    });

    // Shift waiting positions for everyone behind this ticket
    if (ticket.status === TicketStatus.WAITING && ticket.currentPosition > 0) {
      await tx.ticket.updateMany({
        where: {
          status: TicketStatus.WAITING,
          currentPosition: { gt: ticket.currentPosition },
        },
        data: { currentPosition: { decrement: 1 } },
      });
    }

    return updated;
  });

  // 📡 Real-time broadcast
  broadcastQueueEvent(SOCKET_EVENTS.QUEUE_UPDATED, {
    ticketId: cancelledTicket.id,
    ticketNumber: cancelledTicket.ticketNumber,
    status: cancelledTicket.status,
  });

  return cancelledTicket;
}

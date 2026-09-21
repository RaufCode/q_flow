import { prisma } from '../config/db.js';
import { TicketStatus } from '@qflow/database/client';
import { broadcastQueueEvent, SOCKET_EVENTS } from '../sockets/queue.socket.js';
import { logNotification } from '../utils/lognotification.js';

/**
 * 3. Staff Actions on tickets
 */

//--------- Internal helper: resolve a staff member + their bound counter from employeeId ----------
async function resolveStaffAndCounterByEmployeeId(employeeId: string) {
  const staff = await prisma.user.findUnique({ where: { employeeId } });
  if (!staff) throw new Error('Staff member not found.');

  const counter = await prisma.counter.findUnique({ where: { currentStaffId: staff.id } });
  if (!counter) throw new Error('Staff member is not currently bound to a counter.');

  return { staff, counter };
}

//--------- List all counters currently staffed (for the dashboard's desk selector) ----------
export async function listCounters() {
  const counters = await prisma.counter.findMany({
    include: { currentStaff: false },
    orderBy: { counterNumber: 'asc' },
  });

  // Shaped to match the frontend's Counter interface. Counters with no staff
  // bound are excluded, since there's no employeeId to key the selector on.
  return counters
    .map((c) => ({
      activeCounter: c.counterName,
      counterNumber: c.counterNumber,
      isOnline: c.isActive,
    }));
}

//--------- Current CALLED/IN_SERVICE ticket at a given counter ----------
export async function getCurrentTicketForCounter(employeeId: string) {
  const { counter } = await resolveStaffAndCounterByEmployeeId(employeeId);

  return prisma.ticket.findFirst({
    where: {
      counterId: counter.id,
      status: { in: [TicketStatus.CALLED, TicketStatus.IN_SERVICE] },
    },
  });
}

//--------- Waiting queue (global — tickets aren't counter-scoped until called) ----------
export async function getQueueForCounter(employeeId: string) {
  await resolveStaffAndCounterByEmployeeId(employeeId); // validates the binding exists

  return prisma.ticket.findMany({
    where: { status: TicketStatus.WAITING },
    orderBy: { joinedAt: 'asc' },
    take: 50,
  });
}

//--------- Call Next Ticket for Assigned Counter----------
export async function callNextTicket(staffId: string) {
  const counter = await prisma.counter.findUnique({
    where: { currentStaffId: staffId },
  });

  if (!counter || !counter.isActive) {
    throw new Error('Staff member is not bound to an active counter shift.');
  }

  const nextTicket = await prisma.ticket.findFirst({
    where: { status: TicketStatus.WAITING },
    orderBy: { joinedAt: 'asc' },
  });

  if (!nextTicket) {
    throw new Error('No customers currently waiting in the queue.');
  }

  const updatedTicket = await prisma.ticket.update({
    where: { id: nextTicket.id },
    data: {
      status: TicketStatus.CALLED,
      calledAt: new Date(),
      counterId: counter.id,
      servicedByStaffId: staffId,
      currentPosition: 0,
    },
  });

  await logNotification(
    updatedTicket.id,
    updatedTicket.preferredChannel,
    'COUNTER_CALL',
    `It's your turn! Please proceed to ${counter.counterName}.`,
    updatedTicket.phoneNumber
  );

  return { counter, ticket: updatedTicket };
}

//--------- Wrapper: call-next by employeeId (matches the dashboard's route shape) ----------
export async function callNextTicketByEmployeeId(employeeId: string) {
  const { staff } = await resolveStaffAndCounterByEmployeeId(employeeId);
  return callNextTicket(staff.id);
}

//-----------------Skip Ticket (Applies 3-Skip Auto-Cancellation Rule)--------------
export async function skipTicket(ticketId: string, staffId: string) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new Error('Ticket not found.');

  const newSkipCount = ticket.skipCount + 1;

  if (newSkipCount >= 3) {
    const autoCancelledTicket = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        skipCount: newSkipCount,
        status: TicketStatus.AUTO_CANCELLED,
        cancelledAt: new Date(),
        currentPosition: 0,
      },
    });

    await logNotification(
      ticketId,
      ticket.preferredChannel,
      'AUTO_CANCELLED',
      `Your ticket ${ticket.ticketNumber} has been automatically cancelled after 3 skipped calls.`,
      ticket.phoneNumber
    );

    return autoCancelledTicket;
  }

  const waitingCount = await prisma.ticket.count({ where: { status: 'WAITING' } });

  return prisma.ticket.update({
    where: { id: ticketId },
    data: {
      skipCount: newSkipCount,
      status: TicketStatus.WAITING,
      skippedAt: new Date(),
      counterId: null,
      currentPosition: waitingCount + 1,
    },
  });
}

//-------------Mark Ticket as IN_SERVICE (Customer arrives at register)---------------
export async function markTicketInService(ticketId: string, staffId: string) {
  const updatedTicket = await prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket || ticket.status !== TicketStatus.CALLED) {
      throw new Error('Ticket must be in CALLED status to start service.');
    }

    return tx.ticket.update({
      where: { id: ticketId },
      data: {
        status: TicketStatus.IN_SERVICE,
        servicedAt: new Date(),
        servicedByStaffId: staffId,
      },
    });
  });

  broadcastQueueEvent(SOCKET_EVENTS.QUEUE_UPDATED, {
    ticketId: updatedTicket.id,
    ticketNumber: updatedTicket.ticketNumber,
    status: updatedTicket.status,
  });

  return updatedTicket;
}

//-------------Mark Ticket as SERVED (Completed transaction)---------------
export async function markTicketServed(ticketId: string) {
  const updatedTicket = await prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket || ticket.status !== TicketStatus.IN_SERVICE) {
      throw new Error('Ticket must be IN_SERVICE to mark as served.');
    }

    return tx.ticket.update({
      where: { id: ticketId },
      data: {
        status: TicketStatus.SERVED,
        completedAt: new Date(),
        currentPosition: 0,
      },
    });
  });

  broadcastQueueEvent(SOCKET_EVENTS.QUEUE_UPDATED, {
    ticketId: updatedTicket.id,
    ticketNumber: updatedTicket.ticketNumber,
    status: updatedTicket.status,
  });

  return updatedTicket;
}

//-------------Mark Ticket as NO_SHOW (mapped to AUTO_CANCELLED — see notes above)---------------
export async function markTicketNoShow(ticketId: string) {
  const updatedTicket = await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status: TicketStatus.AUTO_CANCELLED,
      cancelledAt: new Date(),
      currentPosition: 0,
    },
  });

  broadcastQueueEvent(SOCKET_EVENTS.QUEUE_UPDATED, {
    ticketId: updatedTicket.id,
    ticketNumber: updatedTicket.ticketNumber,
    status: updatedTicket.status,
  });

  return updatedTicket;
}

//-------------Generic status update entry point for the dashboard's PATCH /status route---------------
export async function updateTicketStatus(ticketId: string, frontendStatus: string, staffId?: string) {
  switch (frontendStatus) {
    case 'SERVED':
      return markTicketServed(ticketId);
    case 'NO_SHOW':
      return markTicketNoShow(ticketId);
    default:
      throw new Error(`Unsupported status transition: ${frontendStatus}`);
  }
}

//-------------Re-notify a customer at CALLED or IN_SERVICE status---------------
export async function recallTicket(ticketId: string) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new Error('Ticket not found.');

  if (ticket.status !== TicketStatus.CALLED && ticket.status !== TicketStatus.IN_SERVICE) {
    throw new Error('Ticket must be CALLED or IN_SERVICE to recall.');
  }

  await logNotification(
    ticket.id,
    ticket.preferredChannel,
    'COUNTER_CALL',
    `Reminder: it's your turn! Please proceed to your assigned counter.`,
    ticket.phoneNumber
  );

  return ticket;
}

//-------------Get Active Shift & Queue Overview (kept — not currently used by the dashboard)---------------
export async function getStaffShiftOverview(staffId: string) {
  const counter = await prisma.counter.findUnique({
    where: { currentStaffId: staffId },
  });

  if (!counter) {
    throw new Error('No active shift bound to this staff account.');
  }

  const currentCalledTicket = await prisma.ticket.findFirst({
    where: {
      counterId: counter.id,
      status: { in: [TicketStatus.CALLED, TicketStatus.IN_SERVICE] },
    },
  });

  const waitingCount = await prisma.ticket.count({
    where: { status: TicketStatus.WAITING },
  });

  return { counter, activeTicket: currentCalledTicket, waitingCount };
}
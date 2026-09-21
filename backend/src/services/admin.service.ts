import QRCode from 'qrcode';
import { prisma } from '../config/db.js';
import bcrypt from 'bcrypt';
import { UserRole, TicketStatus, NotificationChannel } from '@qflow/database/client';
import { broadcastQueueEvent, SOCKET_EVENTS } from '../sockets/queue.socket.js';
import { sanitizeCustomerName, sanitizePhoneNumber } from './ticket.service.js';

const BCRYPT_ROUNDS = 12;

/**
 * Local sanitization helpers for admin-provisioned data (users, counters)
 */
function sanitizeEmployeeId(id: string): string {
  const trimmed = id.trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,20}$/.test(trimmed)) {
    throw new Error('Employee ID must be 3-20 characters: letters, numbers, and hyphens only.');
  }
  return trimmed;
}

function sanitizeFullName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (trimmed.length < 2 || trimmed.length > 100) {
    throw new Error('Full name must be between 2 and 100 characters.');
  }
  if (!/^[\p{L}\s.'-]+$/u.test(trimmed)) {
    throw new Error('Full name contains invalid characters.');
  }
  return trimmed;
}

function sanitizeCounterName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (trimmed.length < 1 || trimmed.length > 100) {
    throw new Error('Counter name must be between 1 and 100 characters.');
  }
  return trimmed;
}

function validatePasswordStrength(password: string): void {
  if (typeof password !== 'string' || password.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    throw new Error('Password must contain uppercase, lowercase, and numeric characters.');
  }
}

/**
 * Generates static QR code assets (Base64 Data URL and SVG String)
 * pointing to the customer self-service check-in URL.
 */
export async function generateStaticBranchQRCode(targetUrl: string) {
  try {
    // 1. Generate High-Res PNG Data URL (for UI previews and standard image downloads)
    const pngDataUrl = await QRCode.toDataURL(targetUrl, {
      errorCorrectionLevel: 'H', // High fault tolerance (30% damage/obscuration recovery)
      margin: 2,
      width: 1024, // High resolution for crisp printing
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    // 2. Generate Vector SVG String (for professional printing & signage scaling)
    const svgString = await QRCode.toString(targetUrl, {
      type: 'svg',
      errorCorrectionLevel: 'H',
      margin: 2,
    });

    return {
      targetUrl,
      pngDataUrl,
      svgString,
    };
  } catch (error) {
    console.error('QR code generation failed:', error);
    throw new Error('Failed to render static QR code assets.');
  }
}



/**
 *  Create a new service counter
 */
export async function createCounter(counterNumber: number, counterName: string) {
  const sanitizedName = sanitizeCounterName(counterName);

  const existingCounter = await prisma.counter.findUnique({
    where: { counterNumber },
  });

  if (existingCounter) {
    throw new Error(`Counter number ${counterNumber} already exists.`);
  }

  return await prisma.counter.create({
    data: {
      counterNumber,
      counterName: sanitizedName,
      isActive: true,
    },
  });
}



/**
 *  List all counters with active staff binding details
 */
export async function getAllCounters() {
  return await prisma.counter.findMany({
    orderBy: { counterNumber: 'asc' },
    include: {
      currentStaff: {
        select: {
          id: true,
          employeeId: true,
          fullName: true,
          role: true,
        },
      },
    },
  });
}



/**
 *  Toggle Counter Active Status (Activate/Deactivate)
 */
export async function toggleCounterStatus(counterId: string, isActive: boolean) {
  const counter = await prisma.counter.findUnique({ where: { id: counterId } });
  if (!counter) throw new Error('Counter not found.');

  // If deactivating, force-unbind any attached staff member
  const dataToUpdate: any = { isActive };
  if (!isActive) {
    dataToUpdate.currentStaffId = null;
  }

  return await prisma.counter.update({
    where: { id: counterId },
    data: dataToUpdate,
  });
}



/**
 *  Forcefully Unbind Staff Shift from a Counter
 */
export async function forceUnbindCounterShift(counterId: string) {
  const counter = await prisma.counter.findUnique({ where: { id: counterId } });
  if (!counter) throw new Error('Counter not found.');

  return await prisma.counter.update({
    where: { id: counterId },
    data: { currentStaffId: null },
  });
}




/**
 * 1. Provision a new user (Staff or Admin)
 */
export async function createUser(data: {
  employeeId: string;
  fullName: string;
  password: string;
  role?: UserRole;
}) {
  const employeeId = sanitizeEmployeeId(data.employeeId);
  const fullName = sanitizeFullName(data.fullName);
  validatePasswordStrength(data.password);

  const existingUser = await prisma.user.findUnique({
    where: { employeeId },
  });

  if (existingUser) {
    throw new Error(`Employee ID ${employeeId} is already registered.`);
  }

  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      employeeId,
      fullName,
      passwordHash,
      role: data.role || UserRole.COUNTER_STAFF,
    },
    select: {
      id: true,
      employeeId: true,
      fullName: true,
      role: true,
      createdAt: true,
    },
  });

  return user;
}



/**
 * 2. List all staff/admin users with their active shift status
 */
export async function getAllUsers(role?: UserRole) {
  return await prisma.user.findMany({
    where: role ? { role } : undefined,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      employeeId: true,
      fullName: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      activeCounter: {
        select: {
          id: true,
          counterNumber: true,
          counterName: true,
          isActive: true,
        },
      },
    },
  });
}



/**
 * 3. Reset a user's password
 */
export async function resetUserPassword(userId: string, newPassword: string) {
  validatePasswordStrength(newPassword);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('User not found.');
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  return { message: `Password successfully reset for employee ID: ${user.employeeId}` };
}



/**
 * 1. Insert VIP / Priority Ticket at the head of the WAITING queue (Position 1)
 */
export async function createPriorityTicket(data: {
  customerName: string;
  phoneNumber: string;
  preferredChannel?: NotificationChannel;
}) {
  const customerName = sanitizeCustomerName(data.customerName);
  const phoneNumber = sanitizePhoneNumber(data.phoneNumber);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const priorityTicket = await prisma.$transaction(async (tx) => {
    const countToday = await tx.ticket.count({
      where: { joinedAt: { gte: todayStart } },
    });

    const ticketNumber = `VIP-${String(countToday + 1).padStart(3, '0')}`;

    // Shift current WAITING tickets down by 1 position
    await tx.ticket.updateMany({
      where: { status: TicketStatus.WAITING },
      data: { currentPosition: { increment: 1 } },
    });

    // Create VIP ticket at currentPosition = 1
    return tx.ticket.create({
      data: {
        ticketNumber,
        customerName,
        phoneNumber,
        preferredChannel: data.preferredChannel || NotificationChannel.WHATSAPP,
        status: TicketStatus.WAITING,
        initialPosition: 1,
        currentPosition: 1,
        estimatedWaitTimeMinutes: 1, // High priority estimate
      },
    });
  });

  // Broadcast real-time queue update
  broadcastQueueEvent(SOCKET_EVENTS.TICKET_CREATED, {
    ticketId: priorityTicket.id,
    ticketNumber: priorityTicket.ticketNumber,
    isPriority: true,
    position: 1,
  });

  return priorityTicket;
}



/**
 * 2. Manual Ticket State Override (Cancel, Re-queue, Force Complete, etc.)
 */
interface TicketOverrideInput {
  status?: TicketStatus;
  customerName?: string;
  phoneNumber?: string;
  preferredChannel?: NotificationChannel;
  reason?: string;
}

export async function overrideTicket(ticketId: string, input: TicketOverrideInput) {
  const updatedTicket = await prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new Error('Ticket not found.');

    const updateData: any = {};

    if (input.customerName !== undefined) {
      updateData.customerName = sanitizeCustomerName(input.customerName);
    }
    if (input.phoneNumber !== undefined) {
      updateData.phoneNumber = sanitizePhoneNumber(input.phoneNumber);
    }
    if (input.preferredChannel !== undefined) {
      updateData.preferredChannel = input.preferredChannel;
    }

    if (input.status !== undefined) {
      updateData.status = input.status;

      switch (input.status) {
        case TicketStatus.CANCELLED:
        case TicketStatus.AUTO_CANCELLED:
          updateData.cancelledAt = new Date();
          updateData.currentPosition = 0;
          break;
        case TicketStatus.SERVED:
          updateData.completedAt = new Date();
          updateData.currentPosition = 0;
          break;
        case TicketStatus.SKIPPED:
          updateData.skippedAt = new Date();
          updateData.currentPosition = 0;
          break;
        case TicketStatus.CALLED:
          updateData.calledAt = new Date();
          updateData.currentPosition = 0;
          break;
        case TicketStatus.IN_SERVICE:
          updateData.servicedAt = new Date();
          updateData.currentPosition = 0;
          break;
        case TicketStatus.WAITING: {
          const waitingCount = await tx.ticket.count({ where: { status: TicketStatus.WAITING } });
          updateData.currentPosition = waitingCount + 1;
          updateData.skipCount = 0;
          break;
        }
      }
    }

    return tx.ticket.update({
      where: { id: ticketId },
      data: updateData,
    });
  });

  broadcastQueueEvent(SOCKET_EVENTS.QUEUE_UPDATED, {
    ticketNumber: updatedTicket.ticketNumber,
    status: updatedTicket.status,
    reason: input.reason || 'Admin override executed',
  });

  return updatedTicket;
}



// List all tickets with optional status filtering, search, and pagination
export async function getAllTickets(filters: {
  status?: TicketStatus;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const page = filters.page || 1;
  const limit = Math.min(filters.limit || 50, 100);
  const skip = (page - 1) * limit;

  const whereClause: any = {};

  if (filters.status) {
    whereClause.status = filters.status;
  }

  if (filters.search) {
    whereClause.OR = [
      { ticketNumber: { contains: filters.search, mode: 'insensitive' } },
      { customerName: { contains: filters.search, mode: 'insensitive' } },
      { phoneNumber: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const [tickets, totalCount] = await Promise.all([
    prisma.ticket.findMany({
      where: whereClause,
      orderBy: { joinedAt: 'desc' },
      skip,
      take: limit,
      include: {
        counter: {
          select: {
            counterNumber: true,
            counterName: true,
          },
        },
        servicedByStaff: {
          select: {
            employeeId: true,
            fullName: true,
          },
        },
      },
    }),
    prisma.ticket.count({ where: whereClause }),
  ]);

  return {
    tickets,
    pagination: {
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    },
  };
}



/**
 * Admin Analytics & Operational Metrics Engine
 */


//-----------Queue System Overview & Wait Time Metrics----------
export async function getSystemAnalytics() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Total tickets issued today
  const totalTicketsToday = await prisma.ticket.count({
    where: { joinedAt: { gte: todayStart } },
  });

  // Ticket status breakdown today
  const statusCounts = await prisma.ticket.groupBy({
    by: ['status'],
    where: { joinedAt: { gte: todayStart } },
    _count: { _all: true },
  });

  // Map status counts to key-value format
  const statusSummary: Record<string, number> = {
    WAITING: 0,
    CALLED: 0,
    IN_SERVICE: 0,
    SERVED: 0,
    CANCELLED: 0,
    AUTO_CANCELLED: 0,
  };
  statusCounts.forEach((sc) => {
    statusSummary[sc.status] = sc._count._all;
  });

  // Fetch served tickets today to calculate average wait & service duration
  const servedTickets = await prisma.ticket.findMany({
    where: {
      joinedAt: { gte: todayStart },
      status: TicketStatus.SERVED,
      servicedAt: { not: null },
      completedAt: { not: null },
    },
    select: {
      joinedAt: true,
      servicedAt: true,
      completedAt: true,
    },
  });

  let totalWaitTimeMs = 0;
  let totalServiceTimeMs = 0;

  servedTickets.forEach((t) => {
    if (t.servicedAt) {
      totalWaitTimeMs += t.servicedAt.getTime() - t.joinedAt.getTime();
    }
    if (t.servicedAt && t.completedAt) {
      totalServiceTimeMs += t.completedAt.getTime() - t.servicedAt.getTime();
    }
  });

  const servedCount = servedTickets.length;
  const avgWaitTimeMinutes = servedCount > 0 ? Math.round(totalWaitTimeMs / servedCount / 60000) : null;
  const avgServiceTimeMinutes = servedCount > 0 ? Math.round(totalServiceTimeMs / servedCount / 60000) : null;

  return {
    date: todayStart.toISOString().split('T')[0],
    totalTicketsToday,
    avgWaitTimeMinutes,
    avgServiceTimeMinutes,
    statusBreakdown: statusSummary,
  };
}



//-----------Staff Efficiency & Counter Performance Metrics----------
export async function getStaffEfficiencyMetrics() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const staffMembers = await prisma.user.findMany({
    where: { role: 'COUNTER_STAFF' },
    select: {
      id: true,
      employeeId: true,
      fullName: true,
      activeCounter: {
        select: {
          counterNumber: true,
          counterName: true,
        },
      },
    },
  });

  const efficiencyData = await Promise.all(
    staffMembers.map(async (staff) => {
      const ticketsServed = await prisma.ticket.findMany({
        where: {
          servicedByStaffId: staff.id,
          status: TicketStatus.SERVED,
          servicedAt: { gte: todayStart },
          completedAt: { not: null },
        },
        select: {
          servicedAt: true,
          completedAt: true,
        },
      });

      let totalDurationMs = 0;
      ticketsServed.forEach((t) => {
        if (t.servicedAt && t.completedAt) {
          totalDurationMs += t.completedAt.getTime() - t.servicedAt.getTime();
        }
      });

      const count = ticketsServed.length;
      const avgHandlingTimeMinutes = count > 0 ? Math.round(totalDurationMs / count / 60000) : null;

      return {
        staffId: staff.id,
        employeeId: staff.employeeId,
        fullName: staff.fullName,
        activeCounter: staff.activeCounter ? `Register ${staff.activeCounter.counterNumber}` : 'Unbound',
        totalTicketsServedToday: count,
        avgHandlingTimeMinutes,
      };
    })
  );

  return efficiencyData;
}
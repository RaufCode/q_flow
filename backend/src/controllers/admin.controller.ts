import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { generateStaticBranchQRCode, getStaffEfficiencyMetrics, getSystemAnalytics } from '../services/admin.service.js';
import { createCounter, createUser, getAllUsers,
  resetUserPassword, getAllTickets, overrideTicket,
  getAllCounters, toggleCounterStatus, forceUnbindCounterShift, 
  createPriorityTicket} from '../services/admin.service.js';
import { TicketStatus, UserRole } from '@qflow/database/client';
import { getSafeErrorMessage } from '../utils/errorHandler.js';

/**
 * GET /api/admin/qr-code
 * Generates static QR code graphics for physical store deployment.
 */
export async function handleGenerateQRCode(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { checkInUrl } = req.body;
    const targetUrl = checkInUrl || process.env.CLIENT_CHECKIN_URL || 'http://localhost:3000/check-in';

    const qrAssets = await generateStaticBranchQRCode(targetUrl);

    res.status(200).json({
      message: 'Static QR code generated successfully.',
      data: qrAssets,
    });
  } catch (error: any) {
    console.error('QR code generation failed:', error);
    res.status(500).json({ error: getSafeErrorMessage(error, 'Error generating QR code.') });
  }
}



// POST /api/admin/counters
export async function handleCreateCounter(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { counterNumber, counterName } = req.body;
    if (!counterNumber || !counterName) {
      res.status(400).json({ error: 'counterNumber and counterName are required.' });
      return;
    }

    const counter = await createCounter(Number(counterNumber), counterName);
    res.status(201).json({ message: 'Counter created successfully.', counter });
  } catch (error: any) {
    console.error('Create counter failed:', error);
    res.status(400).json({ error: getSafeErrorMessage(error, 'Failed to create counter.') });
  }
}



// GET /api/admin/counters
export async function handleGetAllCounters(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const counters = await getAllCounters();
    res.status(200).json({ counters });
  } catch (error: any) {
    console.error('Get all counters failed:', error);
    res.status(500).json({ error: getSafeErrorMessage(error, 'Failed to retrieve counters.') });
  }
}



// PATCH /api/admin/counters/:id/toggle
export async function handleToggleCounter(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof id !== 'string') {
      res.status(400).json({ error: 'Invalid counter ID.' });
      return;
    }

    if (typeof isActive !== 'boolean') {
      res.status(400).json({ error: 'isActive must be a boolean value.' });
      return;
    }

    const counter = await toggleCounterStatus(id, isActive);
    res.status(200).json({ message: 'Counter status updated.', counter });
  } catch (error: any) {
    console.error('Toggle counter failed:', error);
    res.status(400).json({ error: getSafeErrorMessage(error, 'Failed to update counter status.') });
  }
}



// POST /api/admin/counters/:id/force-unbind
export async function handleForceUnbind(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (typeof id !== 'string') {
      res.status(400).json({ error: 'Invalid counter ID.' });
      return;
    }

    const counter = await forceUnbindCounterShift(id);
    res.status(200).json({ message: 'Staff shift successfully unbound.', counter });
  } catch (error: any) {
    console.error('Force unbind failed:', error);
    res.status(400).json({ error: getSafeErrorMessage(error, 'Failed to force unbind shift.') });
  }
}




// POST /api/admin/users
export async function handleCreateUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { employeeId, fullName, password, role } = req.body;

    if (!employeeId || !fullName || !password) {
      res.status(400).json({ error: 'employeeId, fullName, and password are required.' });
      return;
    }

    const user = await createUser({ employeeId, fullName, password, role });
    res.status(201).json({ message: 'User provisioned successfully.', user });
  } catch (error: any) {
    console.error('Create user failed:', error);
    res.status(400).json({ error: getSafeErrorMessage(error, 'Failed to provision user.') });
  }
}

// GET /api/admin/users
export async function handleGetAllUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { role } = req.query;
    
    // Validate role filter if provided
    const roleFilter = role && Object.values(UserRole).includes(role as UserRole)
      ? (role as UserRole)
      : undefined;

    const users = await getAllUsers(roleFilter);
    res.status(200).json({ users });
  } catch (error: any) {
    console.error('Get all users failed:', error);
    res.status(500).json({ error: getSafeErrorMessage(error, 'Failed to retrieve users.') });
  }
}



// POST /api/admin/users/:id/reset-password
export async function handleResetPassword(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (typeof id !== 'string') {
      res.status(400).json({ error: 'Invalid user ID.' });
      return;
    }

    if (!newPassword) {
      res.status(400).json({ error: 'New password is required.' });
      return;
    }

    const result = await resetUserPassword(id, newPassword);
    res.status(200).json(result);
  } catch (error: any) {
    console.error('Reset password failed:', error);
    res.status(400).json({ error: getSafeErrorMessage(error, 'Failed to reset password.') });
  }
}



const VALID_CHANNELS = ['WHATSAPP', 'SMS', 'NONE'];
const VALID_STATUSES = [
  'WAITING',
  'CALLED',
  'IN_SERVICE',
  'SERVED',
  'SKIPPED',
  'CANCELLED',
  'AUTO_CANCELLED',
];

// POST /api/admin/tickets/priority
export async function handleCreatePriorityTicket(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { customerName, phoneNumber, preferredChannel } = req.body;

    if (!customerName || !phoneNumber) {
      res.status(400).json({ error: 'customerName and phoneNumber are required.' });
      return;
    }

    if (preferredChannel !== undefined && !VALID_CHANNELS.includes(preferredChannel)) {
      res.status(400).json({
        error: `Invalid preferredChannel. Must be one of: ${VALID_CHANNELS.join(', ')}.`,
      });
      return;
    }

    const priorityTicket = await createPriorityTicket({
      customerName,
      phoneNumber,
      preferredChannel,
    });

    res.status(201).json({
      message: 'Priority ticket issued at position 1.',
      ticket: priorityTicket,
    });
  } catch (error: any) {
    console.error('Create priority ticket failed:', error);
    res.status(400).json({ error: getSafeErrorMessage(error, 'Failed to issue priority ticket.') });
  }
}

export async function handleOverrideTicketStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { status, customerName, phoneNumber, preferredChannel, reason } = req.body;

    if (typeof id !== 'string') {
      res.status(400).json({ error: 'Invalid ticket ID.' });
      return;
    }

    if (
      status === undefined &&
      customerName === undefined &&
      phoneNumber === undefined &&
      preferredChannel === undefined
    ) {
      res.status(400).json({
        error: 'At least one of status, customerName, phoneNumber, or preferredChannel must be provided.',
      });
      return;
    }

    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}.` });
      return;
    }

    if (preferredChannel !== undefined && !VALID_CHANNELS.includes(preferredChannel)) {
      res.status(400).json({ error: `preferredChannel must be one of: ${VALID_CHANNELS.join(', ')}.` });
      return;
    }

    if (customerName !== undefined && (typeof customerName !== 'string' || !customerName.trim())) {
      res.status(400).json({ error: 'customerName must be a non-empty string.' });
      return;
    }

    if (phoneNumber !== undefined && (typeof phoneNumber !== 'string' || !phoneNumber.trim())) {
      res.status(400).json({ error: 'phoneNumber must be a non-empty string.' });
      return;
    }

    const updatedTicket = await overrideTicket(id, { status, customerName, phoneNumber, preferredChannel, reason });

    res.status(200).json({
      message: 'Ticket updated successfully.',
      ticket: updatedTicket,
    });
  } catch (error: any) {
    console.error('Override ticket failed:', error);
    res.status(400).json({ error: getSafeErrorMessage(error, 'Failed to update ticket.') });
  }
}


// GET /api/v1/admin/tickets
export async function handleGetAllTickets(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { status, search, page, limit } = req.query;

    const result = await getAllTickets({
      status: status ? (status as TicketStatus) : undefined,
      search: search ? String(search) : undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
    });

    res.status(200).json(result);
  } catch (error: any) {
    console.error('Get all tickets failed:', error);
    res.status(500).json({ error: getSafeErrorMessage(error, 'Failed to retrieve tickets.') });
  }
}


// GET /api/admin/analytics/overview
export async function handleGetSystemAnalytics(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const analytics = await getSystemAnalytics();
    res.status(200).json({ analytics });
  } catch (error: any) {
    console.error('Get system analytics failed:', error);
    res.status(500).json({ error: getSafeErrorMessage(error, 'Failed to calculate system analytics.') });
  }
}

// GET /api/admin/analytics/staff-efficiency
export async function handleGetStaffEfficiency(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const metrics = await getStaffEfficiencyMetrics();
    res.status(200).json({ staffEfficiency: metrics });
  } catch (error: any) {
    console.error('Get staff efficiency failed:', error);
    res.status(500).json({ error: getSafeErrorMessage(error, 'Failed to retrieve staff efficiency metrics.') });
  }
}
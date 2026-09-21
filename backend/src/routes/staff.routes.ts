import { Router } from 'express';
import {
  handleListCounters,
  handleGetCurrentTicket,
  handleGetQueue,
  handleCallNext,
  handleUpdateTicketStatus,
  handleRecallTicket,
  handleSkipTicket,
} from '../controllers/staff.controller.js';

import { requireCounterStaff } from '../middlewares/staff.middleware.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = Router();

// Protect all counter staff routes with JWT Auth
router.use(authenticateToken, requireCounterStaff);

/**
 * @openapi
 * /api/staff/counters:
 *   get:
 *     summary: List all counters and their assigned staff
 *     description: Returns every counter desk, whether it's currently staffed, and who's assigned — used to populate the active-desk selector.
 *     tags: [Counter Staff]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of counters retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 counters:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       employeeId:
 *                         type: string
 *                         example: EMP-2201
 *                       fullName:
 *                         type: string
 *                         example: Ama Boateng
 *                       role:
 *                         type: string
 *                         example: COUNTER_STAFF
 *                       activeCounter:
 *                         type: string
 *                         nullable: true
 *                         example: Teller 1
 *                       counterNumber:
 *                         type: integer
 *                         example: 1
 *                       isOnline:
 *                         type: boolean
 *                         example: true
 *       401:
 *         description: Unauthorized - missing or invalid JWT token
 *       403:
 *         description: Forbidden - requires counter staff role
 */
router.get('/counters', handleListCounters);

/**
 * @openapi
 * /api/staff/counters/{employeeId}/current-ticket:
 *   get:
 *     summary: Get the ticket currently being served at a counter
 *     tags: [Counter Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: string
 *         description: Employee ID of the staff member assigned to the counter
 *     responses:
 *       200:
 *         description: Current ticket for the counter, or null if the desk is idle
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ticket:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     id:
 *                       type: string
 *                     ticketNumber:
 *                       type: string
 *                       example: A-103
 *                     customerName:
 *                       type: string
 *                       example: Kojo Mensah
 *                     phoneNumber:
 *                       type: string
 *                       example: "+233201234567"
 *                     status:
 *                       type: string
 *                       enum: [WAITING, CALLED, IN_SERVICE, SERVED, SKIPPED, CANCELLED, AUTO_CANCELLED]
 *                       example: IN_SERVICE
 *                     preferredChannel:
 *                       type: string
 *                       enum: [WHATSAPP, SMS, NONE]
 *                       example: WHATSAPP
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires counter staff role
 *       404:
 *         description: Counter not found for the given employee
 */
router.get('/counters/:employeeId/current-ticket', handleGetCurrentTicket);

/**
 * @openapi
 * /api/staff/counters/{employeeId}/queue:
 *   get:
 *     summary: Get the list of tickets waiting to be called to this counter
 *     tags: [Counter Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: string
 *         description: Employee ID of the staff member assigned to the counter
 *     responses:
 *       200:
 *         description: Waiting queue retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tickets:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       ticketNumber:
 *                         type: string
 *                         example: A-104
 *                       customerName:
 *                         type: string
 *                         example: Efua Owusu
 *                       status:
 *                         type: string
 *                         example: WAITING
 *                       joinedAt:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires counter staff role
 *       404:
 *         description: Counter not found for the given employee
 */
router.get('/counters/:employeeId/queue', handleGetQueue);

/**
 * @openapi
 * /api/staff/counters/{employeeId}/call-next:
 *   post:
 *     summary: Call the next waiting ticket to this counter
 *     tags: [Counter Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: string
 *         description: Employee ID of the staff member assigned to the counter
 *     responses:
 *       200:
 *         description: Next ticket successfully called to the counter
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ticket:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     ticketNumber:
 *                       type: string
 *                       example: A-105
 *                     status:
 *                       type: string
 *                       example: CALLED
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires counter staff role
 *       404:
 *         description: No waiting tickets in queue, or counter not found
 */
router.post('/counters/:employeeId/call-next', handleCallNext);

/**
 * @openapi
 * /api/staff/tickets/{id}/status:
 *   patch:
 *     summary: Update a ticket's status
 *     description: Generic status transition endpoint — e.g. marking a ticket SERVED, CANCELLED, or SKIPPED.
 *     tags: [Counter Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique ticket ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [WAITING, CALLED, IN_SERVICE, SERVED, SKIPPED, CANCELLED, AUTO_CANCELLED]
 *                 example: SERVED
 *     responses:
 *       200:
 *         description: Ticket status updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 ticketNumber:
 *                   type: string
 *                   example: A-103
 *                 status:
 *                   type: string
 *                   example: SERVED
 *       400:
 *         description: Invalid status value or illegal transition from current status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires counter staff role
 *       404:
 *         description: Ticket not found
 */
router.patch('/tickets/:id/status', handleUpdateTicketStatus);

/**
 * @openapi
 * /api/staff/tickets/{id}/recall:
 *   post:
 *     summary: Re-send the counter-call notification for a ticket
 *     description: Re-notifies the customer (via their preferred channel) that they're being called, without changing ticket status.
 *     tags: [Counter Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique ticket ID
 *     responses:
 *       200:
 *         description: Notification re-sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Customer re-notified successfully.
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires counter staff role
 *       404:
 *         description: Ticket not found
 */
router.post('/tickets/:id/recall', handleRecallTicket);

/**
 * @openapi
 * /api/staff/tickets/{id}/skip:
 *   post:
 *     summary: Skip a ticket
 *     description: Skips the current ticket back into the queue. After 3 skipped calls the ticket is automatically cancelled.
 *     tags: [Counter Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique ticket ID
 *     responses:
 *       200:
 *         description: Ticket skipped
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Ticket skipped.
 *                 ticket:
 *                   type: object
 *       400:
 *         description: Invalid ticket ID or transition not allowed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires counter staff role
 *       404:
 *         description: Ticket not found
 */
router.post('/tickets/:id/skip', handleSkipTicket);

export default router;
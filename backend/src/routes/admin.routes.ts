import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requireAdmin } from '../middlewares/admin.middleware.js';
import { 
  handleGenerateQRCode, 
  handleCreateCounter, 
  handleGetAllCounters, 
  handleToggleCounter, 
  handleForceUnbind,
  handleCreateUser, 
  handleGetAllUsers, 
  handleResetPassword, 
  handleCreatePriorityTicket,
  handleOverrideTicketStatus,
  handleGetAllTickets,
  handleGetSystemAnalytics,
  handleGetStaffEfficiency 
} from '../controllers/admin.controller.js';

const router = Router();

// Protect all admin routes with JWT auth & Admin role checks
router.use(authenticateToken, requireAdmin);

/**
 * @openapi
 * /api/v1/admin/qr-code:
 *   get:
 *     summary: Generate the branch check-in QR code
 *     description: Returns both a PNG data URL (for previews/downloads) and an SVG string (for print/signage) pointing at the customer self-service check-in URL.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: QR code assets generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 targetUrl:
 *                   type: string
 *                   example: "https://qflow.example.com/check-in"
 *                 pngDataUrl:
 *                   type: string
 *                   example: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
 *                 svgString:
 *                   type: string
 *                   example: "<svg xmlns=\"http://www.w3.org/2000/svg\" ...>...</svg>"
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/qr-code', handleGenerateQRCode);

/**
 * @openapi
 * /api/v1/admin/counters:
 *   post:
 *     summary: Create a new service counter
 *     tags: [Admin - Counter Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - counterNumber
 *               - counterName
 *             properties:
 *               counterNumber:
 *                 type: integer
 *                 example: 4
 *               counterName:
 *                 type: string
 *                 example: "Teller 4 - VIP"
 *     responses:
 *       201:
 *         description: Counter created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 counterNumber:
 *                   type: integer
 *                   example: 4
 *                 counterName:
 *                   type: string
 *                   example: "Teller 4 - VIP"
 *                 isActive:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Counter number already exists
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *
 *   get:
 *     summary: Retrieve all registered counters
 *     tags: [Admin - Counter Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all counters, ordered by counter number
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   counterNumber:
 *                     type: integer
 *                   counterName:
 *                     type: string
 *                   isActive:
 *                     type: boolean
 *                   currentStaff:
 *                     type: object
 *                     nullable: true
 *                     properties:
 *                       id:
 *                         type: string
 *                       employeeId:
 *                         type: string
 *                         example: "STF-010"
 *                       fullName:
 *                         type: string
 *                         example: "Jane Doe"
 *                       role:
 *                         type: string
 *                         enum: [ADMIN, COUNTER_STAFF]
 */
router.post('/counters', handleCreateCounter);
router.get('/counters', handleGetAllCounters);

/**
 * @openapi
 * /api/v1/admin/counters/{id}/toggle:
 *   patch:
 *     summary: Enable or disable a service counter
 *     description: Deactivating a counter automatically force-unbinds any staff member currently assigned to it.
 *     tags: [Admin - Counter Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique counter ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isActive
 *             properties:
 *               isActive:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Counter status toggled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 counterNumber:
 *                   type: integer
 *                 counterName:
 *                   type: string
 *                 isActive:
 *                   type: boolean
 *                 currentStaffId:
 *                   type: string
 *                   nullable: true
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         description: Counter not found
 */
router.patch('/counters/:id/toggle', handleToggleCounter);

/**
 * @openapi
 * /api/v1/admin/counters/{id}/force-unbind:
 *   post:
 *     summary: Force unbind staff assigned to a counter
 *     description: Unconditionally clears the counter's currently bound staff member, regardless of whether one is assigned.
 *     tags: [Admin - Counter Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique counter ID
 *     responses:
 *       200:
 *         description: Counter's staff binding cleared
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 counterNumber:
 *                   type: integer
 *                 currentStaffId:
 *                   type: string
 *                   nullable: true
 *                   example: null
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         description: Counter not found
 */
router.post('/counters/:id/force-unbind', handleForceUnbind);

/**
 * @openapi
 * /api/v1/admin/users:
 *   post:
 *     summary: Provision a new staff or admin user
 *     tags: [Admin - User Provisioning]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - employeeId
 *               - fullName
 *               - password
 *             properties:
 *               employeeId:
 *                 type: string
 *                 description: 3-20 characters; letters, numbers, and hyphens only.
 *                 example: "STF-010"
 *               fullName:
 *                 type: string
 *                 example: "Jane Doe"
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Min 8 characters, must include uppercase, lowercase, and a digit.
 *                 example: "SecurePass123"
 *               role:
 *                 type: string
 *                 enum: [ADMIN, COUNTER_STAFF]
 *                 description: Defaults to COUNTER_STAFF if omitted.
 *                 example: "COUNTER_STAFF"
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 employeeId:
 *                   type: string
 *                   example: "STF-010"
 *                 fullName:
 *                   type: string
 *                   example: "Jane Doe"
 *                 role:
 *                   type: string
 *                   example: "COUNTER_STAFF"
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Employee ID already registered, or employeeId/fullName/password failed validation
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *
 *   get:
 *     summary: List all system users
 *     tags: [Admin - User Provisioning]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         required: false
 *         schema:
 *           type: string
 *           enum: [ADMIN, COUNTER_STAFF]
 *         description: Optional filter by role
 *     responses:
 *       200:
 *         description: List of system users, newest first
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   employeeId:
 *                     type: string
 *                   fullName:
 *                     type: string
 *                   role:
 *                     type: string
 *                     enum: [ADMIN, COUNTER_STAFF]
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                   updatedAt:
 *                     type: string
 *                     format: date-time
 *                   activeCounter:
 *                     type: object
 *                     nullable: true
 *                     properties:
 *                       id:
 *                         type: string
 *                       counterNumber:
 *                         type: integer
 *                       counterName:
 *                         type: string
 *                       isActive:
 *                         type: boolean
 */
router.post('/users', handleCreateUser);
router.get('/users', handleGetAllUsers);

/**
 * @openapi
 * /api/v1/admin/users/{id}/reset-password:
 *   post:
 *     summary: Reset password for a specific user
 *     tags: [Admin - User Provisioning]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique user ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newPassword
 *             properties:
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 description: Min 8 characters, must include uppercase, lowercase, and a digit.
 *                 example: "NewStrongPassword123"
 *     responses:
 *       200:
 *         description: Password reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Password successfully reset for employee ID: STF-010"
 *       400:
 *         description: New password failed strength validation
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         description: User not found
 */
router.post('/users/:id/reset-password', handleResetPassword);

/**
 * @openapi
 * /api/v1/admin/tickets:
 *   get:
 *     summary: Retrieve queue tickets with filtering, search, and pagination
 *     tags: [Admin - Queue Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [WAITING, CALLED, IN_SERVICE, SERVED, SKIPPED, CANCELLED, AUTO_CANCELLED]
 *       - in: query
 *         name: search
 *         required: false
 *         schema:
 *           type: string
 *         description: Case-insensitive match against ticket number, customer name, or phone number
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Paginated list of tickets, newest first
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
 *                       customerName:
 *                         type: string
 *                       phoneNumber:
 *                         type: string
 *                       status:
 *                         type: string
 *                         enum: [WAITING, CALLED, IN_SERVICE, SERVED, SKIPPED, CANCELLED, AUTO_CANCELLED]
 *                       joinedAt:
 *                         type: string
 *                         format: date-time
 *                       counter:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           counterNumber:
 *                             type: integer
 *                           counterName:
 *                             type: string
 *                       servicedByStaff:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           employeeId:
 *                             type: string
 *                           fullName:
 *                             type: string
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     totalCount:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/tickets', handleGetAllTickets);

/**
 * @openapi
 * /api/v1/admin/tickets/priority:
 *   post:
 *     summary: Insert a high-priority (VIP) ticket at the front of the queue
 *     description: Shifts all currently WAITING tickets back one position and inserts the new ticket at position 1.
 *     tags: [Admin - Queue Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customerName
 *               - phoneNumber
 *             properties:
 *               customerName:
 *                 type: string
 *                 example: "Elderly Customer"
 *               phoneNumber:
 *                 type: string
 *                 example: "233240000000"
 *               preferredChannel:
 *                 type: string
 *                 enum: [WHATSAPP, SMS, NONE]
 *                 description: Defaults to WHATSAPP if omitted.
 *                 example: "WHATSAPP"
 *     responses:
 *       201:
 *         description: Priority ticket created and placed at head of queue
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 ticketNumber:
 *                   type: string
 *                   example: "VIP-001"
 *                 status:
 *                   type: string
 *                   example: "WAITING"
 *                 currentPosition:
 *                   type: integer
 *                   example: 1
 *       400:
 *         description: customerName or phoneNumber failed validation
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.post('/tickets/priority', handleCreatePriorityTicket);

/**
 * @openapi
 * /api/v1/admin/tickets/{id}/override:
 *   patch:
 *     summary: Manually override a ticket's status or details
 *     description: All fields are optional and applied independently — e.g. you can update just customerName without touching status. Setting status to a terminal value (SERVED, CANCELLED, AUTO_CANCELLED, SKIPPED) stamps the corresponding timestamp automatically.
 *     tags: [Admin - Queue Management]
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
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [WAITING, CALLED, IN_SERVICE, SERVED, SKIPPED, CANCELLED, AUTO_CANCELLED]
 *                 example: "CANCELLED"
 *               customerName:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *               preferredChannel:
 *                 type: string
 *                 enum: [WHATSAPP, SMS, NONE]
 *               reason:
 *                 type: string
 *                 description: Included in the real-time broadcast event; not persisted on the ticket record.
 *                 example: "Customer requested cancellation"
 *     responses:
 *       200:
 *         description: Ticket updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 ticketNumber:
 *                   type: string
 *                 status:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         description: Ticket not found
 */
router.patch('/tickets/:id/override', handleOverrideTicketStatus);

/**
 * @openapi
 * /api/v1/admin/analytics/overview:
 *   get:
 *     summary: Get today's system-wide queue metrics
 *     tags: [Admin - Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Today's operational overview, wait/service times, and status breakdown
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 date:
 *                   type: string
 *                   format: date
 *                   example: "2026-09-21"
 *                 totalTicketsToday:
 *                   type: integer
 *                   example: 142
 *                 avgWaitTimeMinutes:
 *                   type: number
 *                   nullable: true
 *                   description: Average time from joining to being serviced, in minutes. Null if no tickets were served today.
 *                   example: 12.4
 *                 avgServiceTimeMinutes:
 *                   type: number
 *                   nullable: true
 *                   description: Average time spent in service, in minutes. Null if no tickets were served today.
 *                   example: 5.1
 *                 statusBreakdown:
 *                   type: object
 *                   description: Count of today's tickets per status
 *                   properties:
 *                     WAITING:
 *                       type: integer
 *                     CALLED:
 *                       type: integer
 *                     IN_SERVICE:
 *                       type: integer
 *                     SERVED:
 *                       type: integer
 *                     SKIPPED:
 *                       type: integer
 *                     CANCELLED:
 *                       type: integer
 *                     AUTO_CANCELLED:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/analytics/overview', handleGetSystemAnalytics);

/**
 * @openapi
 * /api/v1/admin/analytics/staff-efficiency:
 *   get:
 *     summary: Get today's performance metrics per counter staff member
 *     tags: [Admin - Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Per-staff ticket counts and average handling time for today
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   staffId:
 *                     type: string
 *                   employeeId:
 *                     type: string
 *                   fullName:
 *                     type: string
 *                   activeCounter:
 *                     type: string
 *                     example: "Register 3"
 *                     description: "\"Unbound\" if the staff member isn't currently assigned to a counter."
 *                   totalTicketsServedToday:
 *                     type: integer
 *                   avgHandlingTimeMinutes:
 *                     type: number
 *                     nullable: true
 *                     description: Null if the staff member hasn't completed any tickets today.
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/analytics/staff-efficiency', handleGetStaffEfficiency);

export default router;
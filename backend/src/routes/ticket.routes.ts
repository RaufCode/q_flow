import { Router } from 'express';
import { handleCancelTicket, handleCheckIn, handleGetTicketStatus } from '../controllers/ticket.controller.js';

const router = Router();

/**
 * @openapi
 * /api/v1/tickets/check-in:
 *   post:
 *     summary: Issue a new queue ticket
 *     tags: [Tickets]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customerName
 *               - phoneNumber
 *               - serviceTypeId
 *             properties:
 *               customerName:
 *                 type: string
 *                 example: John Doe
 *               phoneNumber:
 *                 type: string
 *                 example: "233240000000"
 *               serviceTypeId:
 *                 type: string
 *                 example: "srv_12345"
 *     responses:
 *       201:
 *         description: Ticket created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ticketId:
 *                   type: string
 *                 ticketNumber:
 *                   type: string
 *                   example: A-102
 *                 status:
 *                   type: string
 *                   example: WAITING
 *       400:
 *         description: Missing required check-in fields
 */
router.post('/check-in', handleCheckIn);

/**
 * @openapi
 * /api/v1/tickets/{id}/status:
 *   get:
 *     summary: Get live status of a queue ticket
 *     tags: [Tickets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique ticket ID
 *     responses:
 *       200:
 *         description: Ticket status details retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 ticketNumber:
 *                   type: string
 *                   example: A-102
 *                 status:
 *                   type: string
 *                   example: WAITING
 *                 positionInQueue:
 *                   type: integer
 *                   example: 3
 *                 estimatedWaitMinutes:
 *                   type: integer
 *                   example: 15
 *       404:
 *         description: Ticket not found
 */
router.get('/:id/status', handleGetTicketStatus);

/**
 * @openapi
 * /api/v1/tickets/{id}/cancel:
 *   post:
 *     summary: Cancel an active queue ticket
 *     tags: [Tickets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique ticket ID
 *     responses:
 *       200:
 *         description: Ticket cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Ticket cancelled successfully
 *                 status:
 *                   type: string
 *                   example: CANCELLED
 *       400:
 *         description: Ticket cannot be cancelled from current state
 *       404:
 *         description: Ticket not found
 */
router.post('/:id/cancel', handleCancelTicket);

export default router;
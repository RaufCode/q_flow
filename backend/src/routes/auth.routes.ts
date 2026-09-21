import { Router } from 'express';
import { handleLogin, handleBindShift, handleUnbindShift } from '../controllers/auth.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { loginLimiter } from '../middlewares/rateLimit.middleware.js';

const router = Router();

/**
 * @openapi
 * /api/v1/auth/login:
 *   post:
 *     summary: Staff member login
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - employeeId
 *               - password
 *             properties:
 *               employeeId:
 *                 type: string
 *                 example: ADM-001
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "YourSecurePassword123!"
 *     responses:
 *       200:
 *         description: Login successful, returns JWT token and user info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     employeeId:
 *                       type: string
 *                       example: ADM-001
 *                     fullName:
 *                       type: string
 *                       example: System Administrator
 *                     role:
 *                       type: string
 *                       example: ADMIN
 *       400:
 *         description: Missing employeeId or password
 *       401:
 *         description: Invalid credentials
 *       429:
 *         description: Too many login attempts, rate limited
 */
router.post('/login', loginLimiter, handleLogin);

/**
 * @openapi
 * /api/v1/auth/bind-shift:
 *   post:
 *     summary: Bind staff member to a counter for the active shift
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - counterId
 *             properties:
 *               counterId:
 *                 type: string
 *                 example: "cnt_12345"
 *     responses:
 *       200:
 *         description: Shift bound to counter successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Shift bound successfully
 *                 counterId:
 *                   type: string
 *                 counterNumber:
 *                   type: integer
 *                   example: 1
 *       400:
 *         description: Counter is already occupied or invalid counterId
 *       401:
 *         description: Unauthorized - missing or invalid JWT token
 */
router.post('/bind-shift', authenticateToken, handleBindShift);

/**
 * @openapi
 * /api/v1/auth/unbind-shift:
 *   post:
 *     summary: Unbind staff member from active counter shift
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Shift unbound successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Shift unbound successfully
 *       400:
 *         description: No active shift binding found
 *       401:
 *         description: Unauthorized - missing or invalid JWT token
 */
router.post('/unbind-shift', authenticateToken, handleUnbindShift);

export default router;
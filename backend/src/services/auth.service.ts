import { prisma } from '../config/db.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/jwt.js';

/**
 * Staff / Admin Login
 */
export async function loginUser(employeeId: string, password: string) {
  const normalizedEmployeeId = employeeId.trim().toUpperCase();

  const user = await prisma.user.findUnique({
    where: { employeeId: normalizedEmployeeId },
    include: { activeCounter: true },
  });

  if (!user) {
    throw new Error('Invalid employee ID or password.');
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new Error('Invalid employee ID or password.');
  }

  const token = jwt.sign(
    { userId: user.id, role: user.role, employeeId: user.employeeId },
    JWT_SECRET,
    { expiresIn: '12h' }
  );

  return {
    token,
    user: {
      id: user.id,
      employeeId: user.employeeId,
      fullName: user.fullName,
      role: user.role,
      activeCounter: user.activeCounter,
    },
  };
}

/**
 * Bind Staff Member to a Counter for an Active Shift
 */
export async function bindShift(userId: string, counterId: string) {
  const counter = await prisma.counter.findUnique({ where: { id: counterId } });
  if (!counter || !counter.isActive) {
    throw new Error('Counter does not exist or is inactive.');
  }

  if (counter.currentStaffId && counter.currentStaffId !== userId) {
    throw new Error('Counter is currently bound to another staff member.');
  }

  const updatedCounter = await prisma.$transaction(async (tx) => {
    await tx.counter.updateMany({
      where: { currentStaffId: userId },
      data: { currentStaffId: null },
    });

    return tx.counter.update({
      where: { id: counterId },
      data: { currentStaffId: userId },
    });
  });

  return updatedCounter;
}

/**
 * Unbind Shift (Clock out / Logout)
 */
export async function unbindShift(userId: string) {
  await prisma.counter.updateMany({
    where: { currentStaffId: userId },
    data: { currentStaffId: null },
  });
  return { message: 'Shift unbound successfully.' };
}
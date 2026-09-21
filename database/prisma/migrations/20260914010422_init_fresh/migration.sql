-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'COUNTER_STAFF');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('WAITING', 'CALLED', 'IN_SERVICE', 'SERVED', 'SKIPPED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('WHATSAPP', 'SMS', 'NONE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'COUNTER_STAFF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counters" (
    "id" TEXT NOT NULL,
    "counterNumber" INTEGER NOT NULL,
    "counterName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "currentStaffId" TEXT,

    CONSTRAINT "counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "preferredChannel" "NotificationChannel" NOT NULL DEFAULT 'WHATSAPP',
    "status" "TicketStatus" NOT NULL DEFAULT 'WAITING',
    "initialPosition" INTEGER NOT NULL,
    "currentPosition" INTEGER NOT NULL,
    "estimatedWaitTimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calledAt" TIMESTAMP(3),
    "servicedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "skippedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "counterId" TEXT,
    "servicedByStaffId" TEXT,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_employeeId_key" ON "users"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "counters_counterNumber_key" ON "counters"("counterNumber");

-- CreateIndex
CREATE UNIQUE INDEX "counters_currentStaffId_key" ON "counters"("currentStaffId");

-- CreateIndex
CREATE INDEX "tickets_status_joinedAt_idx" ON "tickets"("status", "joinedAt");

-- AddForeignKey
ALTER TABLE "counters" ADD CONSTRAINT "counters_currentStaffId_fkey" FOREIGN KEY ("currentStaffId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_counterId_fkey" FOREIGN KEY ("counterId") REFERENCES "counters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_servicedByStaffId_fkey" FOREIGN KEY ("servicedByStaffId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "NotificationTrigger" AS ENUM ('INITIAL_JOIN', 'THRESHOLD_ALERT', 'COUNTER_CALL', 'AUTO_CANCELLED');

-- AlterEnum
ALTER TYPE "TicketStatus" ADD VALUE 'AUTO_CANCELLED';

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "skipCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "trigger" "NotificationTrigger" NOT NULL,
    "message" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

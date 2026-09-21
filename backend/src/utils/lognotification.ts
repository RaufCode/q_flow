import { sendSMSNotification } from '../services/notification.service.js';
import { NotificationTrigger, NotificationChannel } from '@qflow/database/client';
import { prisma } from '../config/db.js';

/**
 * 1. Helper to record notification logs
 */
export async function logNotification(
  ticketId: string,
  channel: NotificationChannel,
  trigger: NotificationTrigger,
  message: string,
  phoneNumber: string
) {
  let delivered = false;

  if (channel === 'SMS') {
    delivered = await sendSMSNotification({ recipient: phoneNumber, message });
  } else if (channel === 'WHATSAPP') {
    // delivered = await sendWhatsAppNotification({ recipient: phoneNumber, message });
  }

  await prisma.notificationLog.create({
    data: { ticketId, channel, trigger, message },
  });

  return delivered;
}
import axios from 'axios';

interface SMSPayload {
  recipient: string; // e.g., "0241234567" or "233241234567"
  message: string;
}

export async function sendSMSNotification({ recipient, message }: SMSPayload): Promise<boolean> {
  const apiKey = process.env.BMS_API_KEY;
  const senderId = process.env.BMS_SENDER_ID || 'QFlow';

  try {
    const response = await axios.post(
      `https://api.mnotify.com/api/sms/quick?key=${apiKey}`,
      {
        recipient: [recipient],
        sender: senderId,
        message: message,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: 10000, // 10s — don't let a slow/hung API block a check-in request indefinitely
      }
    );

    if (response.data && response.data.status === 'success') {
      return true;
    }

    console.warn('BMS Response:', response.data);
    return false;
  } catch (error: any) {
    console.error('BMS SMS Error:', error.response?.data || error.message);
    return false;
  }
}
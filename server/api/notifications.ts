/**
 * API Route: Send Push Notification
 * Sham Cash - Admin Push Notifications
 */

import { VercelRequest, VercelResponse } from '@vercel/node';

// Firebase Cloud Messaging API
const FCM_API_URL = 'https://fcm.googleapis.com/fcm/send';

// Firebase Server Key (should be in environment variables)
const SERVER_KEY = process.env.FIREBASE_SERVER_KEY;

interface NotificationPayload {
  token?: string;
  admin_id?: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token, admin_id, title, body, data } = req.body as NotificationPayload;

    // Validate required fields
    if (!title || !body) {
      return res.status(400).json({ error: 'Title and body are required' });
    }

    // If admin_id provided but no token, get token from database
    let deviceToken = token;
    
    if (!deviceToken && admin_id) {
      // In production, you would fetch the token from Supabase here
      // For now, we'll require the token to be passed
      return res.status(400).json({ error: 'Device token is required' });
    }

    if (!deviceToken) {
      return res.status(400).json({ error: 'Device token is required' });
    }

    // Prepare FCM message
    const fcmMessage = {
      to: deviceToken,
      notification: {
        title,
        body,
        sound: 'default',
        badge: '1',
      },
      data: {
        ...data,
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      android: {
        priority: 'high',
        notification: {
          channel_id: 'sham_cash_notifications',
          sound: 'default',
          priority: 'high',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            content_available: true,
          },
        },
      },
      webpush: {
        headers: {
          Urgency: 'high',
        },
        fcm_options: {
          link: data?.url || '/admin',
        },
      },
    };

    // Send to FCM
    const response = await fetch(FCM_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `key=${SERVER_KEY}`,
      },
      body: JSON.stringify(fcmMessage),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('FCM Error:', result);
      return res.status(500).json({ 
        error: 'Failed to send notification',
        details: result 
      });
    }

    // Check if notification was successful
    if (result.success === 1) {
      return res.status(200).json({ 
        success: true,
        message_id: result.results?.[0]?.message_id 
      });
    } else {
      return res.status(400).json({ 
        error: 'Notification failed',
        details: result 
      });
    }
  } catch (error: any) {
    console.error('Error sending notification:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

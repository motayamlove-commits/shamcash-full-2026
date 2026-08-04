/**
 * API Route: Send Push Notification
 * Sham Cash - Admin Push Notifications
 * 
 * Uses Firebase Admin SDK for secure server-side messaging
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin (singleton pattern)
let firebaseInitialized = false;

function initializeFirebase() {
  if (firebaseInitialized) return;
  
  if (admin.apps.length === 0) {
    // Parse service account from environment variable
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    
    if (serviceAccount) {
      try {
        const parsed = JSON.parse(serviceAccount);
        admin.initializeApp({
          credential: admin.credential.cert(parsed),
        });
        firebaseInitialized = true;
        console.log('[FCM API] Firebase Admin initialized successfully');
      } catch (error) {
        console.error('[FCM API] Error parsing service account:', error);
        throw new Error('Invalid Firebase service account configuration');
      }
    } else {
      throw new Error('Firebase service account not configured');
    }
  }
}

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
    // Initialize Firebase
    initializeFirebase();

    const { token, title, body, data } = req.body as NotificationPayload;

    // Validate required fields
    if (!title || !body) {
      return res.status(400).json({ error: 'Title and body are required' });
    }

    if (!token) {
      return res.status(400).json({ error: 'Device token is required' });
    }

    // Build notification message
    const message: admin.messaging.Message = {
      token: token,
      notification: {
        title,
        body,
      },
      data: {
        ...data,
        click_action: '/admin',
      },
      webpush: {
        fcmOptions: {
          link: data?.url || '/admin',
        },
        headers: {
          Urgency: 'high',
        },
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'sham_cash_notifications',
          sound: 'default',
          priority: 'high',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            contentAvailable: true,
          },
        },
      },
    };

    // Send notification using Firebase Admin SDK
    const messageId = await admin.messaging().send(message);

    console.log('[FCM API] Notification sent successfully:', messageId);

    return res.status(200).json({
      success: true,
      message_id: messageId,
    });
  } catch (error: any) {
    console.error('[FCM API] Error sending notification:', error);

    // Handle specific Firebase errors
    if (error.code === 'messaging/registration-token-not-registered') {
      return res.status(400).json({
        error: 'Token is no longer valid',
        code: 'INVALID_TOKEN',
      });
    }

    if (error.code === 'messaging/invalid-argument') {
      return res.status(400).json({
        error: 'Invalid notification payload',
        code: 'INVALID_PAYLOAD',
      });
    }

    return res.status(500).json({
      error: 'Failed to send notification',
      message: error.message,
    });
  }
}

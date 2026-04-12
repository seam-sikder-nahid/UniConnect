// src/utils/notifications.js
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Send a notification to a user.
 * type: 'reaction' | 'comment' | 'mention' | 'friend_request' | 'friend_accept'
 *       | 'event' | 'notice' | 'share'
 * NOTE: 'message' type is intentionally excluded — messages use their own unread count.
 */
export const sendNotification = async (toUid, fromUid, type, message, refId = '') => {
  if (type === 'message') return; // messages never go to notification panel
  try {
    await addDoc(collection(db, 'notifications'), {
      toUid, fromUid, type, message, refId,
      read: false,
      createdAt: serverTimestamp()
    });
  } catch (e) {
    console.error('sendNotification error:', e);
  }
};

/** Bulk-notify all users in a department (for events/notices) */
export const notifyDepartment = async (department, fromUid, type, message, refId = '', allUsers = []) => {
  const targets = allUsers.filter(u => u.uid !== fromUid && (u.department === department || department === 'General'));
  await Promise.allSettled(
    targets.map(u => sendNotification(u.uid, fromUid, type, message, refId))
  );
};

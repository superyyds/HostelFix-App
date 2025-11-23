// src/api/notifications.js
// Notification Management API

import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  doc, 
  orderBy, 
  onSnapshot,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from './firebase';

/**
 * Notification Types:
 * - COMPLAINT_CREATED: When student creates a complaint
 * - COMPLAINT_UPDATED: When warden updates complaint status
 * - COMPLAINT_ASSIGNED: When warden assigns complaint to staff
 * - COMPLAINT_RESOLVED: When staff marks complaint as resolved
 * - MESSAGE_RECEIVED: When someone sends a message in complaint conversation
 * - FEEDBACK_CREATED: When student creates a feedback
 * - STATUS_CHANGED_BY_WARDEN: When warden changes complaint status
 */

// Create a notification
export const createNotification = async (notificationData) => {
  try {
    // Validate required fields
    if (!notificationData.recipientId) {
      throw new Error('recipientId is required but was undefined');
    }
    
    if (!notificationData.type) {
      throw new Error('Notification type is required');
    }

    const notification = {
      ...notificationData,
      createdAt: serverTimestamp(),
      isRead: false,
      clickedAt: null
    };

    console.log('🔍 DEBUG: Creating notification for recipient:', notificationData.recipientId);
    console.log('📄 DEBUG: Notification payload:', JSON.stringify(notification));

    const docRef = await addDoc(collection(db, 'notifications'), notification);
    console.log('✅ Notification created successfully with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('❌ Error creating notification:', error);
    console.error('❌ Notification data:', notificationData);
    if (error.code === 'permission-denied') {
        console.error('🚫 Permission Denied: Check Firestore Rules for "notifications" collection.');
    }
    throw error;
  }
};

// Get notifications for a specific user
export const getUserNotifications = async (userId, limit = 50) => {
  try {
    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('recipientId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const notifications = [];
    
    querySnapshot.forEach((doc) => {
      notifications.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return notifications;
  } catch (error) {
    console.error('❌ Error fetching notifications:', error);
    throw error;
  }
};

// Mark notification as read
export const markNotificationAsRead = async (notificationId) => {
  try {
    const notificationRef = doc(db, 'notifications', notificationId);
    await updateDoc(notificationRef, {
      isRead: true,
      readAt: serverTimestamp()
    });
    console.log('✅ Notification marked as read:', notificationId);
  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
    throw error;
  }
};

// Mark notification as clicked
export const markNotificationAsClicked = async (notificationId) => {
  try {
    const notificationRef = doc(db, 'notifications', notificationId);
    await updateDoc(notificationRef, {
      isRead: true,
      clickedAt: serverTimestamp()
    });
    console.log('✅ Notification clicked:', notificationId);
  } catch (error) {
    console.error('❌ Error marking notification as clicked:', error);
    throw error;
  }
};

// Mark all user notifications as read
export const markAllAsRead = async (userId) => {
  try {
    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('recipientId', '==', userId),
      where('isRead', '==', false)
    );

    const querySnapshot = await getDocs(q);
    const updatePromises = [];

    querySnapshot.forEach((docSnapshot) => {
      const notificationRef = doc(db, 'notifications', docSnapshot.id);
      updatePromises.push(
        updateDoc(notificationRef, {
          isRead: true,
          readAt: serverTimestamp()
        })
      );
    });

    await Promise.all(updatePromises);
    console.log(`✅ Marked ${updatePromises.length} notifications as read`);
  } catch (error) {
    console.error('❌ Error marking all as read:', error);
    throw error;
  }
};

// Real-time listener for user notifications
export const subscribeToNotifications = (userId, callback) => {
  try {
    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('recipientId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifications = [];
      snapshot.forEach((doc) => {
        notifications.push({
          id: doc.id,
          ...doc.data()
        });
      });
      callback(notifications);
    });

    return unsubscribe;
  } catch (error) {
    console.error('❌ Error subscribing to notifications:', error);
    return () => {}; // Return empty unsubscribe function
  }
};

// ==========================================
// NOTIFICATION CREATION HELPERS
// ==========================================

/**
 * 1. Notify warden when student creates a complaint
 */
export const notifyWardenNewComplaint = async (complaintData, wardenId) => {
  try {
    // Validate wardenId
    if (!wardenId) {
      console.error('❌ Cannot notify warden: wardenId is undefined');
      throw new Error('wardenId is required but was undefined');
    }

    console.log('🔔 Notifying warden:', wardenId, 'about complaint:', complaintData.complaintId);

    await createNotification({
      type: 'COMPLAINT_CREATED',
      recipientId: wardenId,
      title: 'New Complaint Submitted',
      message: `${complaintData.userName} created a new complaint`,
      complaintId: complaintData.complaintId,
      metadata: {
        studentName: complaintData.userName,
        category: complaintData.category,
        priority: complaintData.priority,
        campus: complaintData.campus,
        hostel: complaintData.hostel
      }
    });
    
    console.log('✅ Warden notification sent successfully');
  } catch (error) {
    console.error('❌ Error notifying warden:', error);
    console.error('❌ Warden ID:', wardenId);
    console.error('❌ Complaint data:', complaintData);
    throw error; // Re-throw to help with debugging
  }
};

/**
 * 2. Notify student when warden updates complaint
 */
export const notifyStudentComplaintUpdated = async (complaintData, studentId) => {
  try {
    await createNotification({
      type: 'COMPLAINT_UPDATED',
      recipientId: studentId,
      title: 'Complaint Approved',
      message: 'Your complaint has been approved. Click to see the details.',
      complaintId: complaintData.complaintId,
      metadata: {
        status: complaintData.status,
        category: complaintData.category
      }
    });
  } catch (error) {
    console.error('❌ Error notifying student:', error);
  }
};

/**
 * 3. Notify staff when complaint is assigned to them
 */
export const notifyStaffComplaintAssigned = async (complaintData, staffId) => {
  try {
    await createNotification({
      type: 'COMPLAINT_ASSIGNED',
      recipientId: staffId,
      title: 'New Complaint Assigned',
      message: 'You have a new assigned complaint. Click to see the details.',
      complaintId: complaintData.complaintId,
      metadata: {
        studentName: complaintData.userName,
        category: complaintData.category,
        priority: complaintData.priority,
        campus: complaintData.campus,
        hostel: complaintData.hostel
      }
    });
  } catch (error) {
    console.error('❌ Error notifying staff:', error);
  }
};

/**
 * 4. Notify student when complaint is resolved
 */
export const notifyStudentComplaintResolved = async (complaintData, studentId) => {
  try {
    await createNotification({
      type: 'COMPLAINT_RESOLVED',
      recipientId: studentId,
      title: 'Complaint Resolved! 🎉',
      message: 'Your complaint has been solved! Click to see the details.',
      complaintId: complaintData.complaintId,
      metadata: {
        category: complaintData.category,
        resolvedBy: complaintData.resolvedBy || 'Staff'
      }
    });
  } catch (error) {
    console.error('❌ Error notifying student:', error);
  }
};

/**
 * 5. Notify about new message in complaint conversation
 */
export const notifyNewMessage = async (complaintData, recipientIds, senderName) => {
  try {
    const notificationPromises = recipientIds.map(recipientId =>
      createNotification({
        type: 'MESSAGE_RECEIVED',
        recipientId: recipientId,
        title: 'New Message',
        message: `${senderName} sent a new message in your assigned complaint`,
        complaintId: complaintData.complaintId,
        metadata: {
          senderName: senderName,
          category: complaintData.category
        }
      })
    );

    await Promise.all(notificationPromises);
  } catch (error) {
    console.error('❌ Error notifying about new message:', error);
  }
};

/**
 * 6. Notify warden when staff resolves a complaint
 */
export const notifyWardenComplaintResolved = async (complaintData, wardenId) => {
  try {
    await createNotification({
      type: 'COMPLAINT_RESOLVED',
      recipientId: wardenId,
      title: 'Complaint Resolved',
      message: `${complaintData.resolvedBy} has resolved a complaint. Click to see details.`,
      complaintId: complaintData.complaintId,
      metadata: {
        category: complaintData.category,
        resolvedBy: complaintData.resolvedBy,
        studentName: complaintData.studentName
      }
    });
  } catch (error) {
    console.error('❌ Error notifying warden about resolution:', error);
  }
};

/**
 * 7. Notify staff when warden changes complaint status
 */
export const notifyStaffStatusChanged = async (complaintData, staffId) => {
  try {
    await createNotification({
      type: 'STATUS_CHANGED_BY_WARDEN',
      recipientId: staffId,
      title: 'Status Changed by Warden',
      message: `Warden has changed the complaint status to "${complaintData.status}". Click to see details.`,
      complaintId: complaintData.complaintId,
      metadata: {
        category: complaintData.category,
        newStatus: complaintData.status,
        changedBy: complaintData.changedBy || 'Warden'
      }
    });
  } catch (error) {
    console.error('❌ Error notifying staff about status change:', error);
  }
};

/**
 * 8. Notify student when warden changes complaint status
 */
export const notifyStudentStatusChangedByWarden = async (complaintData, studentId) => {
  try {
    await createNotification({
      type: 'STATUS_CHANGED_BY_WARDEN',
      recipientId: studentId,
      title: 'Complaint Status Updated',
      message: `Your complaint is reopened again. Click to see the details.`,
      complaintId: complaintData.complaintId,
      metadata: {
        category: complaintData.category,
        newStatus: complaintData.status,
        changedBy: complaintData.changedBy || 'Warden'
      }
    });
  } catch (error) {
    console.error('❌ Error notifying student about status change:', error);
  }
};

/**
 * 9. Notify warden when student creates a feedback
 */
export const notifyWardenNewFeedback = async (feedbackData, wardenId) => {
  try {
    // Validate wardenId
    if (!wardenId) {
      console.error('❌ Cannot notify warden: wardenId is undefined');
      throw new Error('wardenId is required but was undefined');
    }

    console.log('🔔 Notifying warden:', wardenId, 'about feedback from:', feedbackData.userName);

    await createNotification({
      type: 'FEEDBACK_CREATED',
      recipientId: wardenId,
      title: 'New Feedback Submitted',
      message: `${feedbackData.userName} submitted new feedback`,
      feedbackId: feedbackData.feedbackId,
      complaintId: feedbackData.complaintId,
      metadata: {
        studentName: feedbackData.userName,
        averageRating: feedbackData.averageRating,
        complaintId: feedbackData.complaintId
      }
    });
    
    console.log('✅ Warden notification sent successfully');
  } catch (error) {
    console.error('❌ Error notifying warden about feedback:', error);
    console.error('❌ Warden ID:', wardenId);
    console.error('❌ Feedback data:', feedbackData);
    throw error; // Re-throw to help with debugging
  }
};


# 🔔 HostelFix Notification System Documentation

## Overview
This document describes the real-time notification system implemented for the HostelFix application. The system provides instant updates to users (students, staff, and wardens) about complaint-related activities.

---

## 📋 Features Implemented

### ✅ 1. New Complaint Notification (Student → Warden)
**Trigger:** When a student creates a new complaint  
**Recipient:** All wardens  
**Message:** "User XXX created a new complaint"  
**Includes:** Date, time, category, priority, campus, hostel  
**Action:** Clicking navigates to complaint list

### ✅ 2. Complaint Update Notification (Warden → Student)
**Trigger:** When a warden updates complaint status  
**Recipient:** Student who created the complaint  
**Message:** "Your complaint has been approved. Click to see the details."  
**Includes:** Date, time, status, category  
**Action:** Clicking navigates to complaint detail page

### ✅ 3. Assignment Notification (Warden → Staff)
**Trigger:** When a warden assigns complaint to staff  
**Recipient:** Assigned staff member  
**Message:** "You have a new assigned complaint. Click to see the details."  
**Includes:** Date, time, student name, category, priority, location  
**Action:** Clicking navigates to complaint detail page

### ✅ 4. Resolution Notification (Staff → Student)
**Trigger:** When staff marks complaint as "Resolved"  
**Recipient:** Student who created the complaint  
**Message:** "Your complaint has been solved! Click to see the details."  
**Includes:** Date, time, category  
**Action:** Clicking navigates to complaint detail page

### ✅ 5. Message Notification (Any → Student & Staff)
**Trigger:** When someone sends a message in complaint conversation  
**Recipient:** Student (complaint creator) + Assigned staff (NOT warden)  
**Message:** "XXX sent a new message in your assigned complaint"  
**Includes:** Date, time, sender name, category  
**Action:** Clicking navigates to complaint detail page

---

## 🏗️ Architecture

### Database Schema (Firestore Collection: `notifications`)

```javascript
{
  id: "auto-generated",
  type: "COMPLAINT_CREATED" | "COMPLAINT_UPDATED" | "COMPLAINT_ASSIGNED" | 
        "COMPLAINT_RESOLVED" | "MESSAGE_RECEIVED",
  recipientId: "user-uid",
  title: "Notification Title",
  message: "Notification message text",
  complaintId: "complaint-document-id",
  isRead: false,
  createdAt: Timestamp,
  readAt: Timestamp | null,
  clickedAt: Timestamp | null,
  metadata: {
    // Additional context-specific data
    studentName: "...",
    category: "...",
    priority: "...",
    // etc.
  }
}
```

---

## 📁 File Structure

```
src/
├── api/
│   ├── notifications.js          # Core notification API & helpers
│   └── firebase.js                # Existing Firebase config
├── components/
│   └── NotificationBell.jsx       # Notification UI component
└── pages/
    ├── ComplaintForm.jsx          # Triggers: New complaint
    ├── ComplaintDetail.jsx         # Triggers: Updates, assignments, messages
    ├── StudentDashboard.jsx        # Displays notification bell
    ├── StaffDashboard.jsx          # Displays notification bell
    └── WardenDashboard.jsx         # Displays notification bell
```

---

## 🔧 Key Functions

### `src/api/notifications.js`

#### Core Functions:
- `createNotification(data)` - Creates a new notification
- `subscribeToNotifications(userId, callback)` - Real-time listener
- `markNotificationAsRead(notificationId)` - Mark single as read
- `markNotificationAsClicked(notificationId)` - Mark as clicked
- `markAllAsRead(userId)` - Mark all user notifications as read

#### Helper Functions:
- `notifyWardenNewComplaint(complaintData, wardenId)`
- `notifyStudentComplaintUpdated(complaintData, studentId)`
- `notifyStaffComplaintAssigned(complaintData, staffId)`
- `notifyStudentComplaintResolved(complaintData, studentId)`
- `notifyNewMessage(complaintData, recipientIds, senderName)`

---

## 🎨 UI Components

### `NotificationBell.jsx`
**Features:**
- Real-time notification counter badge
- Dropdown notification panel
- "Mark all as read" functionality
- Click to navigate to related complaint
- Timestamp formatting (e.g., "5m ago", "2h ago")
- Visual distinction for read/unread notifications
- Category and priority badges
- Emoji icons for different notification types

**Props:**
- `userId`: Current user's UID
- `onNotificationClick(complaintId, notification)`: Callback when notification is clicked

---

## 🔄 Notification Flow

### Example Flow: Student Creates Complaint

```
1. Student fills out ComplaintForm
   └─> handleSubmit() called
       └─> addDoc() creates complaint in Firestore
           └─> notifyWardenNewComplaint() triggered
               └─> Creates notification document for warden
                   └─> Real-time listener updates warden's NotificationBell
                       └─> Warden sees notification badge (unread count)
                           └─> Warden clicks notification
                               └─> markNotificationAsClicked() updates status
                                   └─> Navigates to complaint list
```

---

## 🧪 Testing Guide

### Setup Requirements:
1. Firebase project configured with Firestore
2. At least 3 test accounts:
   - 1 Student account
   - 1 Staff account
   - 1 Warden account
3. `.env` file with Firebase credentials

### Test Scenarios:

#### Test 1: New Complaint Notification
**Steps:**
1. Log in as **Student**
2. Create a new complaint via ComplaintForm
3. Log out and log in as **Warden**
4. Check notification bell (should show red badge)
5. Open notification panel
6. Verify notification shows student name, category, priority
7. Click notification
8. Verify navigation to complaint list

**Expected Result:** ✅ Warden receives notification immediately

---

#### Test 2: Complaint Update Notification
**Steps:**
1. Log in as **Warden**
2. Open a pending complaint
3. Change status from "Pending" to "In Progress"
4. Click "Update"
5. Log out and log in as **Student** (who created the complaint)
6. Check notification bell
7. Click notification

**Expected Result:** ✅ Student receives "Your complaint has been approved" notification

---

#### Test 3: Staff Assignment Notification
**Steps:**
1. Log in as **Warden**
2. Open a complaint
3. Assign to a staff member from dropdown
4. Click "Update"
5. Log out and log in as **Staff** (assigned staff)
6. Check notification bell
7. Verify notification shows complaint details

**Expected Result:** ✅ Staff receives assignment notification

---

#### Test 4: Resolution Notification
**Steps:**
1. Log in as **Staff**
2. Open an assigned complaint
3. Change status to "Resolved"
4. Upload proof images
5. Click "Update"
6. Log out and log in as **Student**
7. Check notification bell

**Expected Result:** ✅ Student receives "Your complaint has been solved!" notification

---

#### Test 5: Message Notification
**Steps:**
1. Log in as **Staff**
2. Open an assigned complaint
3. Type a message in conversation box
4. Click send
5. Log out and log in as **Student**
6. Check notification bell
7. Verify message notification

**Expected Result:** ✅ Student receives message notification (Warden does NOT)

**Additional Test:**
- As Student, send a message
- Assigned Staff should receive notification
- Warden should NOT receive notification

---

## 🐛 Troubleshooting

### Issue: Notifications not appearing
**Solutions:**
1. Check Firebase Console → Firestore → `notifications` collection
2. Verify user is logged in and `userId` is passed to `NotificationBell`
3. Check browser console for errors
4. Ensure Firestore security rules allow read/write to `notifications` collection

### Issue: Notification bell badge not updating
**Solutions:**
1. Check real-time listener is active (console logs)
2. Verify `subscribeToNotifications` is called with correct `userId`
3. Check network tab for Firestore connection

### Issue: Click navigation not working
**Solutions:**
1. Verify `onNotificationClick` callback is properly wired
2. Check `complaintId` exists in notification document
3. Verify routing logic in dashboard components

---

## 🔐 Security Considerations

### Firestore Security Rules

Add these rules to your Firestore:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Notifications - users can only read their own
    match /notifications/{notificationId} {
      allow read: if request.auth != null && 
                     resource.data.recipientId == request.auth.uid;
      allow write: if request.auth != null;
    }
  }
}
```

---

## 🚀 Future Enhancements

### Potential Improvements:
1. **Push Notifications**: Integrate Firebase Cloud Messaging (FCM)
2. **Email Notifications**: Send email summaries for unread notifications
3. **Notification Settings**: Allow users to customize notification preferences
4. **Notification History**: Archive old notifications (auto-delete after 30 days)
5. **Sound Alerts**: Optional sound when new notification arrives
6. **Desktop Notifications**: Browser notification API integration
7. **Batch Notifications**: Group similar notifications ("3 new complaints")
8. **Notification Filtering**: Filter by type/priority in notification panel

---

## 📊 Performance Notes

- Real-time listeners are optimized with Firestore indexes
- Notifications auto-sort by `createdAt` (descending)
- Panel limits display to prevent performance issues
- Unread count calculated client-side for instant updates
- Notification creation uses `serverTimestamp()` for consistency

---

## 🎓 Usage Examples

### Creating a Custom Notification

```javascript
import { createNotification } from '../api/notifications';

await createNotification({
  type: 'CUSTOM_TYPE',
  recipientId: 'user-uid',
  title: 'Custom Title',
  message: 'Custom message text',
  complaintId: 'optional-complaint-id',
  metadata: {
    // Any additional data
    customField: 'value'
  }
});
```

### Subscribing to Notifications

```javascript
import { subscribeToNotifications } from '../api/notifications';

const unsubscribe = subscribeToNotifications(userId, (notifications) => {
  console.log('Received notifications:', notifications);
  // Update UI state
});

// Cleanup
return () => unsubscribe();
```

---

## ✅ Checklist for Implementation Complete

- [x] Notification API created (`notifications.js`)
- [x] NotificationBell component built
- [x] Integrated into all 3 dashboards (Student, Staff, Warden)
- [x] Trigger #1: New complaint → Notify warden
- [x] Trigger #2: Status update → Notify student
- [x] Trigger #3: Assignment → Notify staff
- [x] Trigger #4: Resolution → Notify student
- [x] Trigger #5: Message → Notify student & staff (not warden)
- [x] Real-time updates working
- [x] Click navigation implemented
- [x] Read/unread status tracking
- [x] Timestamp formatting
- [x] Visual UI with badges and icons

---

## 📞 Support

For issues or questions about the notification system:
1. Check console logs for debug messages (🔔, ✅, ⚠️, ❌ prefixes)
2. Verify Firebase connection
3. Review this documentation
4. Check Firestore Console for notification documents

---

**Last Updated:** November 21, 2024  
**Version:** 1.0.0  
**Author:** HostelFix Development Team


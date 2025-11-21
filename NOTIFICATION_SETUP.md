# 🚀 Notification System Setup Guide

## Quick Start (5 Minutes)

### Step 1: Firestore Setup
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your HostelFix project
3. Navigate to **Firestore Database**
4. Go to **Rules** tab
5. Copy the rules from `firestore.rules.example`
6. Click **Publish**

### Step 2: Create Index (Optional but Recommended)
Firestore will automatically prompt you to create indexes when needed. The notification system requires:

**Index for `notifications` collection:**
- Collection ID: `notifications`
- Fields to index:
  - `recipientId` (Ascending)
  - `createdAt` (Descending)

**To create manually:**
1. Go to Firestore Database → Indexes
2. Click "Create Index"
3. Collection ID: `notifications`
4. Add field: `recipientId` → Ascending
5. Add field: `createdAt` → Descending
6. Click "Create"

### Step 3: Verify Installation
1. Start your dev server: `npm run dev`
2. Log in as any user
3. Check that the notification bell appears in the header
4. Check browser console for: "🔔 Setting up notification listener"

---

## Testing the System

### Test Flow (Complete Example)

#### Prerequisites:
- 3 test accounts created via RegisterUserPage:
  - Student: `student1@student.usm.my`
  - Staff: `staff1@usm.my`
  - Warden: `warden1@usm.my`

#### Test Sequence:

**1️⃣ Create Complaint (Student → Warden)**
```
Action: Student creates a complaint
Expected: 
  - Warden sees notification bell badge (red dot)
  - Console shows: ✅ Warden(s) notified about new complaint
  - Notification appears in warden's panel
```

**2️⃣ Assign to Staff (Warden → Staff)**
```
Action: Warden opens complaint, assigns to staff, clicks Update
Expected:
  - Staff sees notification bell badge
  - Console shows: ✅ Staff notified about new assignment
  - Notification: "You have a new assigned complaint"
```

**3️⃣ Update Status (Warden → Student)**
```
Action: Warden changes status to "In Progress"
Expected:
  - Student sees notification
  - Console shows: ✅ Student notified about complaint update
  - Notification: "Your complaint has been approved"
```

**4️⃣ Send Message (Staff ↔ Student)**
```
Action: Staff sends message in complaint detail
Expected:
  - Student receives notification
  - Warden does NOT receive notification
  - Console shows: ✅ Message notification sent
```

**5️⃣ Resolve Complaint (Staff → Student)**
```
Action: Staff marks complaint as "Resolved"
Expected:
  - Student sees notification
  - Console shows: ✅ Student notified about complaint resolution
  - Notification: "Your complaint has been solved! 🎉"
```

---

## Debugging Tips

### Check Notification Creation
```javascript
// Open browser console
// Run this to manually check notifications collection
firebase.firestore().collection('notifications').get()
  .then(snap => console.log('Total notifications:', snap.size))
```

### Common Issues:

**Issue 1: "Permission Denied" errors**
- **Solution:** Update Firestore rules (see `firestore.rules.example`)

**Issue 2: Notifications not appearing**
- **Check 1:** Console shows "🔔 Setting up notification listener"?
- **Check 2:** userId is passed to NotificationBell component?
- **Check 3:** Firestore rules allow read for current user?

**Issue 3: Red badge not showing**
- **Check:** Notification document has `isRead: false`
- **Solution:** Clear old notifications or mark all as read

**Issue 4: Click doesn't navigate**
- **Check:** `complaintId` exists in notification document
- **Solution:** Verify notification creation includes `complaintId`

---

## Verification Checklist

After setup, verify each notification type works:

- [ ] ✅ Student creates complaint → Warden notified
- [ ] ✅ Warden updates status → Student notified  
- [ ] ✅ Warden assigns to staff → Staff notified
- [ ] ✅ Staff resolves complaint → Student notified
- [ ] ✅ Message sent → Recipients notified (not warden)
- [ ] ✅ Bell badge shows unread count
- [ ] ✅ Click notification navigates correctly
- [ ] ✅ Mark as read works
- [ ] ✅ Mark all as read works
- [ ] ✅ Real-time updates work (no refresh needed)

---

## Production Deployment

### Before deploying to production:

1. **Update Firestore Rules** (more restrictive):
```javascript
// Only allow system/admin to create notifications
allow create: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['warden', 'staff'];
```

2. **Add Firestore Indexes** (from Step 2 above)

3. **Set up monitoring**:
   - Monitor notification creation rate
   - Set alerts for failed notifications
   - Track notification click-through rate

4. **Consider Cloud Functions** (advanced):
   - Move notification creation to server-side
   - Better security and reliability
   - Can add email/SMS notifications

---

## File Changes Summary

### New Files Created:
```
src/api/notifications.js              # Core notification logic
src/components/NotificationBell.jsx   # UI component
firestore.rules.example                # Security rules
NOTIFICATION_SYSTEM_GUIDE.md          # Full documentation
NOTIFICATION_SETUP.md                 # This file
```

### Modified Files:
```
src/pages/StudentDashboard.jsx        # Added NotificationBell
src/pages/StaffDashboard.jsx          # Added NotificationBell
src/pages/WardenDashboard.jsx         # Added NotificationBell
src/pages/ComplaintForm.jsx           # Trigger: New complaint
src/pages/ComplaintDetail.jsx         # Triggers: Updates, messages
src/App.jsx                            # Pass userId to dashboards
```

---

## Next Steps

After setup is complete:

1. **Test all scenarios** (see Test Flow above)
2. **Review logs** in browser console
3. **Check Firestore Console** for notification documents
4. **Customize styling** if needed (NotificationBell.jsx)
5. **Add more notification types** as needed (use existing patterns)

---

## Support

If you encounter issues:

1. Check browser console for error messages
2. Review `NOTIFICATION_SYSTEM_GUIDE.md` for detailed documentation
3. Verify Firestore rules are published
4. Check Firebase project quota (free tier limits)

---

**Setup Time:** ~5 minutes  
**Testing Time:** ~10 minutes  
**Total:** ~15 minutes to fully functional system

Good luck! 🚀


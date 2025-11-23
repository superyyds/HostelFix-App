import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { X, ClipboardList, FileText, MessageSquare, Send, UserCog, Loader2, ImageIcon, CheckCircle, AlertTriangle } from "lucide-react";
import { doc, updateDoc, getDocs, onSnapshot, query, collection, where } from "firebase/firestore";

import { db } from "../api/firebase";
import InfoRow from "../components/InfoRow";
import PrimaryButton from "../components/PrimaryButton";
import MessageBox from "../components/MessageBox";
import { 
  notifyStudentComplaintUpdated, 
  notifyStaffComplaintAssigned, 
  notifyStudentComplaintResolved, 
  notifyNewMessage,
  notifyWardenComplaintResolved,
  notifyStaffStatusChanged,
  notifyStudentStatusChangedByWarden
} from "../api/notifications";

const STATUS = { PENDING: 'Pending', IN_PROGRESS: 'In Progress', RESOLVED: 'Resolved' };

const ComplaintDetail = ({ complaint, currentUser, onClose, onGiveFeedback }) => {
  
  if (!complaint) return null;
  if (!currentUser) return null;

  // --- State Separation ---

  // 1. Form State (for Warden's dropdowns)
  const [formStatus, setFormStatus] = useState(complaint.status);
  const [formAssignedToId, setFormAssignedToId] = useState(complaint.assignedTo || "");
  const [proofImage, setProofImage] = useState([]);
  const [existingResolvedImages, setExistingResolvedImages] = useState(complaint.resolvedImage || []);

  // 2. Display State (for Info Panel, updated by listener)
  const [displayStatus, setDisplayStatus] = useState(complaint.status);
  const [displayAssignedToId, setDisplayAssignedToId] = useState(complaint.assignedTo || "");
  const [displayAssignedStaffName, setDisplayAssignedStaffName] = useState("Unassigned");
  const [loadingDisplayStaffName, setLoadingDisplayStaffName] = useState(false);

  // 3. Shared State
  const [remarks, setRemarks] = useState("");
  const [localRemarks, setLocalRemarks] = useState(complaint.remarks || "");
  const [isUpdating, setIsUpdating] = useState(false);
  const [staffList, setStaffList] = useState([]);
  const [loadingStaffList, setLoadingStaffList] = useState(false);
  const [messageBox, setMessageBox] = useState({ visible: false, type: "", title: "", text: "" });
  const chatEndRef = useRef(null);

  const isWarden = currentUser.role === "warden";
  const isStudent = currentUser.role === "student";
  const isStaff = currentUser.role === "staff";
  
  // --- Functions ---
  const sendRemark = async () => {
    if (!remarks.trim()) return;

    var newRemarkLine = "";

    if (isWarden) {
      newRemarkLine = `${currentUser.name}: ${remarks}`;
    }
    else {
      newRemarkLine = `${currentUser.name} (${currentUser.role}): ${remarks}`;
    }

    const newRemarks = (localRemarks ? localRemarks + "\n" : "") + newRemarkLine;
    setLocalRemarks(newRemarks);
    setRemarks("");
    try {
      const docRef = doc(db, "complaints", complaint._id);
      await updateDoc(docRef, { remarks: newRemarks });

      // 🔔 NOTIFICATION #7: Notify about new message
      // Notify student and assigned staff based on who sent the message
      const recipientIds = [];
      
      if (isWarden) {
        // Warden sends message: notify student and assigned staff
        if (complaint.userId) {
          recipientIds.push(complaint.userId);
        }
        if (complaint.assignedTo) {
          recipientIds.push(complaint.assignedTo);
        }
      } else if (isStudent) {
        // Student sends message: notify assigned staff only (not warden)
        if (complaint.assignedTo) {
          recipientIds.push(complaint.assignedTo);
        }
      } else if (isStaff) {
        // Staff sends message: notify student only (not warden)
        if (complaint.userId) {
          recipientIds.push(complaint.userId);
        }
      }

      if (recipientIds.length > 0) {
        try {
          await notifyNewMessage(
            {
              complaintId: complaint._id,
              category: complaint.category
            },
            recipientIds,
            currentUser.name || "Someone"
          );
          console.log('✅ Message notification sent to:', recipientIds);
        } catch (notifError) {
          console.error('⚠️ Failed to send message notification:', notifError);
        }
      }
    } catch (err) {
      console.error("Error updating remarks:", err);
    }
  };

  // applyUpdate
  const applyUpdate = async () => {
    setIsUpdating(true);
    const updates = {};
    
    // Track what changed for notifications
    const statusChanged = formStatus !== displayStatus;
    const assignmentChanged = formAssignedToId !== displayAssignedToId;
    const isBeingResolved = formStatus === STATUS.RESOLVED && displayStatus !== STATUS.RESOLVED;

    if (assignmentChanged) {
        updates.assignedTo = formAssignedToId || null;
    }
    if (formStatus === STATUS.RESOLVED) {
        updates.dateResolved = new Date().toISOString();
        
        const newResolvedImages = proofImage.length > 0 
            ? await Promise.all(
                proofImage.map(file => 
                    new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result);
                        reader.readAsDataURL(file);
                    })
                )
            )
            : [];
      
        updates.resolvedImage = [...existingResolvedImages, ...newResolvedImages];
    } else {
        updates.dateResolved = null;
        updates.resolvedImage = [];
    }
    if (remarks.trim()) {
      const newRemarkLine = `${currentUser.name}: ${remarks}`;
      updates.remarks = (localRemarks ? localRemarks + "\n" : "") + newRemarkLine;
    }

    updates.status = formStatus;

    // Only update if there are changes
    if (Object.keys(updates).length > 0) {
      try {
        const docRef = doc(db, "complaints", complaint._id);
        await updateDoc(docRef, updates);
        
        // 🔔 NOTIFICATIONS
        try {
          // #2: Notify student when warden updates complaint (changes status)
          if (isWarden && statusChanged && complaint.userId) {
            // Check the status transition to send appropriate notification
            const previousStatus = displayStatus;
            const newStatus = formStatus;
            
            // Case 1: Pending -> In Progress: Send "Complaint Approved" notification
            if (previousStatus === STATUS.PENDING && newStatus === STATUS.IN_PROGRESS) {
              await notifyStudentComplaintUpdated(
                {
                  complaintId: complaint._id,
                  status: formStatus,
                  category: complaint.category,
                  changedBy: currentUser.name || 'Warden'
                },
                complaint.userId
              );
              console.log('✅ Student notified: Complaint Approved');
            }
            // Case 2: Resolved -> In Progress: Send "Complaint Status Updated" notification
            // Student receives: "Complaint Status Updated" - "Your complaint is reopened again. Click to see the details."
            else if (previousStatus === STATUS.RESOLVED && newStatus === STATUS.IN_PROGRESS) {
              await notifyStudentStatusChangedByWarden(
                {
                  complaintId: complaint._id,
                  status: formStatus,
                  category: complaint.category,
                  changedBy: currentUser.name || 'Warden'
                },
                complaint.userId
              );
              console.log('✅ Student notified: Complaint Status Updated (Resolved -> In Progress)');
            }
            // Case 3: Other status changes: Send generic status change notification
            else {
              await notifyStudentStatusChangedByWarden(
                {
                  complaintId: complaint._id,
                  status: formStatus,
                  category: complaint.category,
                  changedBy: currentUser.name || 'Warden'
                },
                complaint.userId
              );
              console.log('✅ Student notified about status change by warden');
            }
            
            // #2b: Notify assigned staff when warden changes status (for all status changes including Resolved -> In Progress)
            // Staff receives: "Status Changed by Warden" - "Warden has changed the complaint status to "In Progress". Click to see details."
            if (complaint.assignedTo) {
              await notifyStaffStatusChanged(
                {
                  complaintId: complaint._id,
                  status: formStatus,
                  category: complaint.category,
                  changedBy: currentUser.name || 'Warden'
                },
                complaint.assignedTo
              );
              console.log('✅ Assigned staff notified about status change by warden');
            }
          }

          // #3: Notify staff when complaint is assigned to them
          if (isWarden && assignmentChanged && formAssignedToId) {
            await notifyStaffComplaintAssigned(
              {
                complaintId: complaint._id,
                userName: complaint.userName,
                category: complaint.category,
                priority: complaint.priority,
                campus: complaint.campus,
                hostel: complaint.hostel
              },
              formAssignedToId
            );
            console.log('✅ Staff notified about new assignment');
          }

          // #8: Notify student when staff resolves complaint
          if (isStaff && isBeingResolved && complaint.userId) {
            await notifyStudentComplaintResolved(
              {
                complaintId: complaint._id,
                category: complaint.category,
                resolvedBy: currentUser.name || "Staff"
              },
              complaint.userId
            );
            console.log('✅ Student notified about complaint resolution');

            // #9: Notify all wardens when staff resolves complaint
            try {
              const wardensQuery = query(collection(db, "users"), where("role", "==", "warden"));
              const wardensSnapshot = await getDocs(wardensQuery);
              
              const wardenNotificationPromises = wardensSnapshot.docs.map(wardenDoc => {
                const wardenId = wardenDoc.id;
                return notifyWardenComplaintResolved(
                  {
                    complaintId: complaint._id,
                    category: complaint.category,
                    resolvedBy: currentUser.name || "Staff",
                    studentName: complaint.userName
                  },
                  wardenId
                );
              });

              await Promise.all(wardenNotificationPromises);
              console.log('✅ Wardens notified about complaint resolution');
            } catch (wardenNotifError) {
              console.error('⚠️ Failed to notify wardens about resolution:', wardenNotifError);
            }
          }
        } catch (notifError) {
          console.error('⚠️ Failed to send notifications:', notifError);
          // Don't fail the update if notification fails
        }

        // Clear form fields
        setRemarks("");
        setProofImage([]);
        
        // For wardens: stay on complaint details page and show success message
        // For staff: redirect to complaint list page
        if (isWarden) {
          // Show success message in modal, stay on page
          setMessageBox({
            visible: true,
            type: "success",
            title: "Complaint Updated!",
            text: "Complaint updated successfully!"
          });
          setTimeout(() => {
            setMessageBox({ visible: false, type: "", title: "", text: "" });
          }, 3000);
        } else {
          // Close modal and show success message on complaint list page
          onClose({ success: true, message: "Complaint updated successfully!" });
        }
      } catch (err) {
        console.error("Error updating complaint:", err);
        setMessageBox({
          visible: true,
          type: "error",
          title: "Update Failed",
          text: "Failed to update complaint. Please try again."
        });
        // Auto-hide error notification after 5 seconds
        setTimeout(() => {
          setMessageBox({ visible: false, type: "", title: "", text: "" });
        }, 5000);
      } finally {
        setIsUpdating(false);
      }
    } else {
      setIsUpdating(false);
    }
  };

  const handleProofImageChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setProofImage(prev => [...prev, ...newFiles]);
    }
  };

  const removeProofImage = (index, isExisting = false) => {
    if (isExisting) {
        setExistingResolvedImages(prev => prev.filter((_, i) => i !== index));
    } else {
        setProofImage(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleClose = () => {
      setProofImage([]);
      setExistingResolvedImages(complaint.resolvedImage || []);
      onClose();
  };

  // --- Effects ---

  // smooth scrolling effect in chat window
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localRemarks]);

  // fetch assigned staff name (for DISPLAY)
  useEffect(() => {
    const fetchStaffName = async () => {
      if (!displayAssignedToId) {
        setDisplayAssignedStaffName("Unassigned");
        return;
      }

      setLoadingDisplayStaffName(true);
      try {
        const q = query(collection(db, "users"), where("uid", "==", displayAssignedToId));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          setDisplayAssignedStaffName(userDoc.data().name || "Unknown Staff");
        } else {
          setDisplayAssignedStaffName("Unknown Staff");
        }
      } catch (error) {
        console.error("Error fetching staff name:", error);
        setDisplayAssignedStaffName("Error loading name");
      } finally {
        setLoadingDisplayStaffName(false);
      }
    };

    fetchStaffName();
  }, [displayAssignedToId]);

  // fetch real-time complaint updates
  useEffect(() => {
    const docRef = doc(db, "complaints", complaint._id);
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const updated = snapshot.data();
        setLocalRemarks(updated.remarks || "");
        setDisplayStatus(updated.status); 
        setDisplayAssignedToId(updated.assignedTo || "");
      }
    });
    return () => unsubscribe();
  }, [complaint._id]);

  // fetch staff list 
  useEffect(() => {
    const fetchStaffList = async () => {
      if (!isWarden) return;
      setLoadingStaffList(true);
      try {
        const q = query(collection(db, "users"), where("role", "==", "staff"));
        const querySnapshot = await getDocs(q);
        const staff = querySnapshot.docs.map(doc => ({
          uid: doc.data().uid,
          name: doc.data().name
        }));
        setStaffList(staff);
      } catch (error) {
        console.error("Error fetching staff list:", error);
      } finally {
        setLoadingStaffList(false);
      }
    };
    fetchStaffList();
  }, [isWarden]);

  const remarkList = (localRemarks || "")
    .split("\n")
    .filter(Boolean)
    .map((r, i) => {
      const [sender, ...msgParts] = r.split(": ");
      const msg = msgParts.join(": ");
      const isCurrentUser = sender === currentUser.name + ` (${currentUser.role})` || sender === currentUser.name;
      return (
        <div key={i} className={`flex ${isCurrentUser ? "justify-end" : "justify-start"} mb-2`}>
          <div
            className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm ${
              isCurrentUser
                ? "bg-indigo-600 text-white rounded-br-none"
                : "bg-gray-200 text-gray-800 rounded-bl-none"
            }`}
          >
            {!isCurrentUser && (
              <div className="text-xs font-semibold text-gray-600 mb-1">{sender}</div>
            )}
            {msg}
          </div>
        </div>
      );
    });

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-6 backdrop-blur-sm">
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden relative animate-fadeIn max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b bg-gradient-to-r from-indigo-600 to-blue-500 text-white shrink-0">
          <h3 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="w-6 h-6" />
            Complaint Details
          </h3>
          <button onClick={handleClose} className="p-2 rounded-full hover:bg-white/20 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1">
          <div className="m-8 grid grid-cols-2 gap-8">
            {/* LEFT: Info */}
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-indigo-700 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Complaint Information
              </h4>

              <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-sm text-gray-700">
                <InfoRow label="Category" value={complaint.category} />
                <InfoRow
                  label="Urgency"
                  value={
                    <span
                      className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                        complaint.priority === "High"
                          ? "bg-red-100 text-red-700"
                          : complaint.priority === "Medium"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {complaint.priority}
                    </span>
                  }
                />
                <InfoRow label="Campus" value={complaint.campus} />
                <InfoRow label="Hostel" value={complaint.hostel} />
                <InfoRow
                  label="Status"
                  value={
                    <span
                      // Use DISPLAY state
                      className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                        displayStatus === STATUS.PENDING
                          ? "bg-yellow-100 text-yellow-700"
                          : displayStatus === STATUS.IN_PROGRESS
                          ? "bg-blue-100 text-blue-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {displayStatus}
                    </span>
                  }
                />
                <InfoRow label="Submitted by" value={complaint.userName} />
                <InfoRow
                  label="Assigned to"
                  value={
                    // Use DISPLAY state
                    loadingDisplayStaffName ? (
                      <div className="flex items-center gap-2 text-gray-500">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Loading...</span>
                      </div>
                    ) : (
                      displayAssignedStaffName
                    )
                  }
                />
                <InfoRow
                  label="Date Submitted"
                  value={
                    complaint.dateSubmitted?.toDate
                      ? complaint.dateSubmitted.toDate().toLocaleString()
                      : new Date(complaint.dateSubmitted).toLocaleString()
                  }
                />
              </div>

              {/* Description */}
              <div className="mt-4">
                <h4 className="text-lg font-semibold text-indigo-700 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-indigo-600" />
                  Description
                </h4>
                <div className="p-4 bg-gray-50 rounded-xl text-gray-700 leading-relaxed whitespace-pre-line">
                  {complaint.description}
                </div>
              </div>

              {/* Attachments */}
              <div className="mt-4">
                <h4 className="text-lg font-semibold text-indigo-700 flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-indigo-600" />
                  Attachment(s)
                </h4>
                {Array.isArray(complaint.attachments) && complaint.attachments.length > 0 ? (
                  <div className="flex flex-wrap gap-4 m-4">
                    {complaint.attachments.map((file, i) => {
                      const fileURL = typeof file === 'string' ? file : file?.dataUrl || null;
                      const fileName = file?.name || `Attachment ${i + 1}`;
                      if (!fileURL) return null;
                      return (
                        <div key={i} className="relative group overflow-hidden shadow-sm hover:shadow-md transition">
                          <img
                            src={fileURL}
                            alt={fileName}
                            className="w-40 h-40 object-cover"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                            <a
                              href={fileURL}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-white text-sm font-medium bg-indigo-600 hover:bg-indigo-700 px-3 py-1"
                            >
                              View Full
                            </a>
                          </div>
                          <div className="text-xs text-center text-gray-500 mt-1 truncate w-40">
                            {fileName}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-gray-50 p-4 flex items-center justify-center text-gray-400 italic text-center">
                    No attachments uploaded.
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: Chat + Actions */}
            <div className="space-y-4 flex flex-col">
              <h4 className="text-lg font-semibold text-indigo-700 flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Conversation
              </h4>

              <div className="bg-gray-50 rounded-xl p-4 flex flex-col flex-grow h-0 min-h-0">
                {/* Chat window */}
                <div className="flex-grow overflow-y-auto bg-white border rounded-lg p-4 min-h-0">
                  {remarkList.length ? remarkList : (
                    <div className="h-full flex items-center justify-center text-gray-400 italic text-center">
                      No conversation yet.
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Input + Send */}
                {displayStatus !== STATUS.RESOLVED && (
                  <div className="flex items-center gap-2 mt-4 shrink-0">
                    <textarea
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      rows={2}
                      placeholder="Type your message..."
                      className="flex-grow p-3 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                    />
                    <button
                      onClick={sendRemark}
                      className="p-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shrink-0"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {!isStudent && (
            <div className="m-8 pt-8 border-t border-gray-200 shrink-0">
              <h4 className="text-lg font-semibold text-indigo-700 flex items-center gap-2 mb-4">
                <UserCog className="w-5 h-5" />
                Actions & Updates
              </h4>

              <div className="bg-gray-50 rounded-xl p-6">
                <div>
                  <div className={`grid ${isWarden ? 'grid-cols-2' : 'grid-cols-1'} gap-6`}>
                    <div>
                      <label className="block text-sm font-medium mb-3">Update Status</label>
                      <select
                        value={formStatus}
                        onChange={(e) => setFormStatus(e.target.value)}
                        className="w-full p-2 mb-4 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        <option>{STATUS.PENDING}</option>
                        <option>{STATUS.IN_PROGRESS}</option>
                        <option>{STATUS.RESOLVED}</option>
                      </select>
                    </div>

                    { isWarden && (
                      <div>
                        <label className="block text-sm font-medium mb-4">Assign to (staff)</label>
                          <select
                            // Use FORM state
                            value={formAssignedToId}
                            onChange={(e) => setFormAssignedToId(e.target.value)}
                            disabled={loadingStaffList}
                            className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-gray-100"
                          >
                            <option value="">Unassigned</option>
                            {staffList.map((staff) => (
                              <option key={staff.uid} value={staff.uid}>
                                {staff.name}
                              </option>
                            ))}
                          </select>
                        {loadingStaffList && <p className="text-xs text-gray-500 mt-1">Loading staff list...</p>}
                      </div>
                    )}
                  </div>

                  {formStatus == STATUS.RESOLVED && (
                    <div>
                      <label className="block text-sm font-medium mb-3">Resolved Image(s)</label>
                      <p className="text-xs text-gray-500 mb-2">At least one proof image is required for resolving the issue.</p>
                      <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-indigo-400 transition-colors duration-300">
                        <input 
                          type="file" 
                          multiple 
                          accept="image/*" 
                          onChange={handleProofImageChange} 
                          className="hidden" 
                          id="image-upload"
                        />
                        <label 
                          htmlFor="image-upload" 
                          className="cursor-pointer block"
                        >
                          <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                          <p className="text-gray-600 mb-2">Click to upload images or drag and drop</p>
                          <p className="text-sm text-gray-500">PNG, JPG, JPEG up to 10MB each</p>
                        </label>
                      </div>

                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4"
                      >
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          
                          {existingResolvedImages.map((imageUrl, index) => (
                            <div key={`existing-${index}`} className="relative group">
                                <img
                                    src={imageUrl}
                                    alt={`Resolved proof ${index + 1}`}
                                    className="w-full h-24 object-cover rounded-lg border border-gray-200"
                                />
                                <button
                                    type="button"
                                    onClick={() => removeProofImage(index, true)}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                >
                                    ×
                                </button>
                                <p className="text-xs text-gray-500 mt-1 truncate">Proof image {index + 1}</p>
                            </div>
                        ))}

                        {proofImage.map((file, index) => (
                            <div key={`new-${index}`} className="relative group">
                                <img
                                    src={URL.createObjectURL(file)}
                                    alt={`Preview ${index + 1}`}
                                    className="w-full h-24 object-cover rounded-lg border border-gray-200"
                                />
                                <button
                                    type="button"
                                    onClick={() => removeProofImage(index, false)}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                >
                                    ×
                                </button>
                                <p className="text-xs text-gray-500 mt-1 truncate">{file.name}</p>
                            </div>
                        ))}
                        </div>
                      </motion.div>
                    </div>
                  )}
                </div>
              </div>

              {/* Update button for warden */}
              <div className="flex justify-center mt-6">
                <PrimaryButton 
                  onClick={applyUpdate} 
                  disabled={isUpdating}
                  className="w-auto px-8"
                >
                  {isUpdating ? (
                    <div className="flex justify-center items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Updating...
                    </div>
                  ) : (
                    "Update"
                  )}
                </PrimaryButton>
              </div>
            </div>
          )}

          {isStudent && formStatus === STATUS.RESOLVED && (
            <div className="m-8 pt-8 border-t border-gray-200 shrink-0">
              <h4 className="text-lg font-semibold text-indigo-700 flex items-center gap-2 mb-4">
                <ImageIcon className="w-5 h-5" />
                Resolved Image(s)
              </h4>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 mb-6"
              >
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  
                  {existingResolvedImages.map((imageUrl, index) => (
                    <div key={`existing-${index}`} className="relative group">
                        <img
                            src={imageUrl}
                            alt={`Resolved proof ${index + 1}`}
                            className="w-full h-24 object-cover rounded-lg border border-gray-200"
                        />
                        <p className="text-xs text-gray-500 mt-1 truncate">Proof image {index + 1}</p>
                    </div>
                  ))}
                </div>
              </motion.div>

              <PrimaryButton onClick={onGiveFeedback}>
                Give Feedback
              </PrimaryButton>
            </div>
          )} 
        </div>
      </div>

      {/* Message Box */}
      {messageBox.visible && (
        <div className="fixed top-4 right-4 z-50 max-w-sm w-full p-2">
          <MessageBox
            title={messageBox.title}
            text={messageBox.text}
            type={messageBox.type}
            onClose={() => setMessageBox({ visible: false, type: "", title: "", text: "" })}
            className="pointer-events-auto"
          />
        </div>
      )}
    </div>
  );
};

export default ComplaintDetail;
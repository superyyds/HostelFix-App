import React, { useState, useEffect, useRef } from "react";
import { X, ClipboardList, FileText, MessageSquare, Send, UserCog } from "lucide-react";
import { doc, updateDoc, onSnapshot } from "firebase/firestore";

import { db } from "../api/firebase";
import InfoRow from "../components/InfoRow";
import PrimaryButton from "../components/PrimaryButton";

const STATUS = { PENDING: 'Pending', IN_PROGRESS: 'In Progress', RESOLVED: 'Resolved' };

const ComplaintDetail = ({ complaint, currentUser, onClose, onGiveFeedback }) => {
  const [remarks, setRemarks] = useState("");
  const [assignedTo, setAssignedTo] = useState(complaint.assignedTo || "");
  const [status, setStatus] = useState(complaint.status);
  const [localRemarks, setLocalRemarks] = useState(complaint.remarks || "");
  const chatEndRef = useRef(null);
  const [isUpdating, setIsUpdating] = useState(false);

  if (!complaint) return null;
  if (!currentUser) return null;

  const isWarden = currentUser.role === "warden";
  const isOriginallyResolved = complaint.status === STATUS.RESOLVED;

  // update remark
  const sendRemark = async () => {
    if (!remarks.trim()) return;

    const newRemarkLine = `${currentUser.name}: ${remarks}`;
    const newRemarks = (localRemarks ? localRemarks + "\n" : "") + newRemarkLine;

    setLocalRemarks(newRemarks);
    setRemarks("");

    try {
      const docRef = doc(db, "complaints", complaint._id);
      await updateDoc(docRef, { remarks: newRemarks });
    } catch (err) {
      console.error("Error updating remarks:", err);
    }
  };

  const applyUpdate = async () => {
    setIsUpdating(true);
    const updates = {};
    if (assignedTo !== complaint.assignedTo) updates.assignedTo = assignedTo || null;
    if (status !== complaint.status) {
      updates.status = status;
      updates.dateResolved = status === STATUS.RESOLVED ? new Date().toISOString() : null;
    }
    if (remarks.trim()) {
      const newRemarkLine = `${currentUser.name}: ${remarks}`;
      updates.remarks = (localRemarks ? localRemarks + "\n" : "") + newRemarkLine;
    }

    try {
      const docRef = doc(db, "complaints", complaint._id);
      await updateDoc(docRef, updates);
      setRemarks("");
      onClose();
    } catch (err) {
      console.error("Error updating complaint:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localRemarks]);

  useEffect(() => {
    const docRef = doc(db, "complaints", complaint._id);
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const updated = snapshot.data();
        setLocalRemarks(updated.remarks || "");
        setStatus(updated.status);
        setAssignedTo(updated.assignedTo || "");
      }
    });

    return () => unsubscribe();
  }, [complaint._id]);

  const remarkList = (localRemarks || "")
    .split("\n")
    .filter(Boolean)
    .map((r, i) => {
      const [sender, ...msgParts] = r.split(": ");
      const msg = msgParts.join(": ");
      const isCurrentUser = sender === currentUser.name;
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
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/20 transition">
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
                label="Priority"
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
                    className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                      complaint.status === STATUS.PENDING
                        ? "bg-yellow-100 text-yellow-700"
                        : complaint.status === STATUS.IN_PROGRESS
                        ? "bg-blue-100 text-blue-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {complaint.status}
                  </span>
                }
              />
              <InfoRow label="Submitted by" value={complaint.userName} />
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
              <h4 className="text-md font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-indigo-600" />
                Description
              </h4>
              <div className="p-4 bg-gray-50 rounded-xl text-gray-700 leading-relaxed whitespace-pre-line">
                {complaint.description}
              </div>
            </div>

            {/* Attachments */}
            <div className="mt-4">
              <h4 className="text-md font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                Attachments
              </h4>

              {Array.isArray(complaint.attachments) && complaint.attachments.length > 0 ? (
                <div className="flex flex-wrap gap-4 mb-4">
                  {complaint.attachments.map((file, i) => {
                    const fileURL = file?.dataUrl || null;
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

            <div className="bg-gray-50 rounded-xl p-4 flex flex-col flex-grow">
              {/* Chat window */}
              <div className="flex-grow overflow-y-auto bg-white border rounded-lg p-4 mb-4 min-h-[18rem]">
                {remarkList.length ? remarkList : (
                  <div className="h-full flex items-center justify-center text-gray-400 italic text-center">
                    No conversation yet.
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input + Send */}
              {!isOriginallyResolved && (
                <div className="flex items-center gap-2">
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={2}
                    placeholder="Type your message..."
                    className="flex-grow p-3 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                  />
                  <button
                    onClick={sendRemark}
                    className="p-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>

            {/* Feedback button for student */}
            {isOriginallyResolved && currentUser.role === "student" && (
              <PrimaryButton onClick={onGiveFeedback}>
                Give Feedback
              </PrimaryButton>
            )}
          </div>
        </div>

        {isWarden && (
            <div className="m-8 pt-8 border-t border-gray-200 shrink-0">
              <h4 className="text-lg font-semibold text-indigo-700 flex items-center gap-2 mb-4">
                <UserCog className="w-5 h-5" />
                Actions & Updates
              </h4>

              <div className="bg-gray-50 rounded-xl p-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-1">Change Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option>{STATUS.PENDING}</option>
                      <option>{STATUS.IN_PROGRESS}</option>
                      <option>{STATUS.RESOLVED}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Assign to (staff)</label>
                    <input
                      value={assignedTo}
                      onChange={(e) => setAssignedTo(e.target.value)}
                      className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="Enter staff name"
                    />
                  </div>
                </div>
              </div>

              {/* Update button for warden */}
              <div className="flex justify-end pt-4">
                <PrimaryButton 
                  onClick={applyUpdate} 
                  disabled={isUpdating}
                  className="flex justify-center"
                >
                  {isUpdating ? (
                    <div className="flex items-center gap-2">
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
        </div>
      </div>    
    </div>
  );
};

export default ComplaintDetail;
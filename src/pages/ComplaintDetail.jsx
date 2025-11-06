import React, { useState, useEffect, useRef } from "react";
import { X, ClipboardList, FileText, MessageSquare, Send, UserCog } from "lucide-react";

import InfoRow from "../components/InfoRow";
import PrimaryButton from "../components/PrimaryButton";

const STATUS = { PENDING: 'Pending', IN_PROGRESS: 'In Progress', RESOLVED: 'Resolved' };

const ComplaintDetail = ({ complaint, currentUser, onClose, onUpdate, onGiveFeedback }) => {
  const [remarks, setRemarks] = useState("");
  const [assignedTo, setAssignedTo] = useState(complaint.assignedTo || "");
  const [status, setStatus] = useState(complaint.status);
  const [localRemarks, setLocalRemarks] = useState(complaint.remarks || "");
  const chatEndRef = useRef(null);

  if (!complaint) return null;

  const isWarden = currentUser.role === "warden";
  const isOriginallyResolved = complaint.status === STATUS.RESOLVED;

  const sendRemark = () => {
    if (!remarks.trim()) return;
    const newRemarkLine = `${currentUser.name}: ${remarks}`;
    const newRemarks = (localRemarks ? localRemarks + "\n" : "") + newRemarkLine;

    // 🟢 Update locally
    setLocalRemarks(newRemarks);
    setRemarks("");

    // Sync to parent state
    onUpdate(complaint._id, { remarks: newRemarks });
  };

  const applyUpdate = () => {
    const updates = {};
    if (assignedTo !== complaint.assignedTo) updates.assignedTo = assignedTo || null;
    if (status !== complaint.status) {
      updates.status = status;
      updates.dateResolved = status === STATUS.RESOLVED ? new Date().toISOString() : null;
    }
    if (remarks.trim()) {
      const newRemarkLine = `${currentUser.name}: ${remarks}`;
      updates.remarks = (localRemarks ? localRemarks + "\n" : "") + newRemarkLine;
      setLocalRemarks((prev) => (prev ? prev + "\n" + newRemarkLine : newRemarkLine));
    }
    onUpdate(complaint._id, updates);
    setRemarks("");
    onClose();
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localRemarks]);

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
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden relative animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b bg-gradient-to-r from-indigo-600 to-blue-500 text-white">
          <h3 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="w-6 h-6" />
            Complaint Details
          </h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/20 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 grid grid-cols-2 gap-8">
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
                value={new Date(complaint.dateSubmitted).toLocaleString()}
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

              {complaint.attachments?.length ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 bg-gray-50 rounded-xl p-4">
                  {complaint.attachments.map((file, i) => (
                    <div
                      key={i}
                      className="relative group rounded-lg overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition"
                    >
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`attachment-${i}`}
                        className="w-full h-32 object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                        <a
                          href={URL.createObjectURL(file)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-white text-sm font-medium bg-indigo-600 hover:bg-indigo-700 px-3 py-1 rounded"
                        >
                          View Full
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-50 rounded-xl p-4 text-gray-400 italic">No attachments.</div>
              )}
            </div>
          </div>

          {/* RIGHT: Chat + Actions */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-indigo-700 flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Conversation
            </h4>

            <div className="bg-gray-50 rounded-xl p-4 flex flex-col flex-grow">
              {/* Chat window */}
              <div className="flex-grow overflow-y-auto bg-white border rounded-lg p-4 mb-4 h-72">
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

            {/* Warden-only controls */}
            {isWarden && (
              <div>
                <h4 className="text-lg font-semibold text-indigo-700 flex items-center gap-2">
                  <UserCog className="w-5 h-5" />
                  Actions & Updates
                </h4>

                <div className="bg-gray-50 rounded-xl p-4 flex flex-col flex-grow">
                  <div className="mt-4 space-y-3">
                    <label className="block text-sm font-medium">Change Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option>{STATUS.PENDING}</option>
                      <option>{STATUS.IN_PROGRESS}</option>
                      <option>{STATUS.RESOLVED}</option>
                    </select>

                    <label className="block text-sm font-medium">Assign to (staff)</label>
                    <input
                      value={assignedTo}
                      onChange={(e) => setAssignedTo(e.target.value)}
                      className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="Enter staff name"
                    />
                  </div>
                </div>
              </div>
            )}
            
            {/* Update button for warden */}
            { currentUser.role === "warden" && (
              <div className="flex justify-end pt-3">
                <PrimaryButton onClick={applyUpdate}>Update</PrimaryButton>
              </div>
            )}
            
            {/* Feedback button for student */}
            {isOriginallyResolved && currentUser.role === "student" && (
              <PrimaryButton onClick={onGiveFeedback}>
                Give Feedback
              </PrimaryButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComplaintDetail;
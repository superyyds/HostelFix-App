import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  Star,
  Send,
  ArrowLeft,
  Loader,
  CheckCircle,
  AlertTriangle,
  User,
} from "lucide-react";
import PrimaryButton from "../components/PrimaryButton";
import MessageBox from "../components/MessageBox";
import { collection, onSnapshot } from "firebase/firestore";

import { db } from "../api/firebase";

const FeedbackForm = ({
  onBack,
  onSubmitFeedback,
  editingFeedback,
  onCancelEdit,
  currentUser, 
}) => {
  // --- Step Management ---
  const [step, setStep] = useState(1);

  // --- Step 3 (Feedback data) ---
  const [feedbackText, setFeedbackText] = useState(editingFeedback?.feedbackText || "");
  const [ratings, setRatings] = useState(
    editingFeedback?.ratings || {
      responseTime: 0,
      serviceQuality: 0,
      communication: 0,
    }
  );
  const [image, setImage] = useState(editingFeedback?.image || null);
  const fileInputRef = useRef(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [messageBox, setMessageBox] = useState({ visible: false, type: "", title: "", text: "" });

  // --- Step 2 (Complaint ID) ---
  const [selectedComplaintId, setSelectedComplaintId] = useState("");
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedComplaint, setSelectedComplaint] = useState(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "complaints"), (snapshot) => {
      let data = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
      
      // Only show the current user's complaints
      if (currentUser?.role === "student") {
        data = data.filter(c => c.userId === currentUser.uid);
      }

      setComplaints(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    if (editingFeedback) {
      setFeedbackText(editingFeedback.feedbackText || "");
      setRatings(editingFeedback.ratings || {
        responseTime: 0,
        serviceQuality: 0,
        communication: 0,
      });
      setImage(editingFeedback.image || null);
      setSelectedComplaintId(editingFeedback.complaintId || "");
    } else {
      // Clear form when no editing feedback
      setFeedbackText("");
      setRatings({ responseTime: 0, serviceQuality: 0, communication: 0 });
      setImage(null);
      setSelectedComplaintId("");
      setSelectedComplaint(null);
    }
  }, [editingFeedback]);

  // Pre-select complaint when editing feedback
  useEffect(() => {
    if (complaints.length === 0) return;

    if (editingFeedback?.complaintId) {
      const complaint = complaints.find(c => c._id === editingFeedback.complaintId);
      if (complaint) {
        setSelectedComplaintId(complaint._id);
        setSelectedComplaint(complaint);
      }
    }
  }, [complaints, editingFeedback]);

  // Save to localStorage on input change
  useEffect(() => {
    const draft = {
      step,
      selectedComplaintId,
      feedbackText,
      ratings,
      image,
    };
    localStorage.setItem('feedbackDraft', JSON.stringify(draft));
  }, [step, selectedComplaintId, feedbackText, ratings, image]);

  // Load from localStorage on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem('feedbackDraft');
    if (savedDraft) {
      const draft = JSON.parse(savedDraft);
      setStep(draft.step || 1);
      setSelectedComplaintId(draft.selectedComplaintId || "");
      setFeedbackText(draft.feedbackText || "");
      setRatings(draft.ratings || { responseTime: 0, serviceQuality: 0, communication: 0 });
      setImage(draft.image || null);
    }
  }, []);

  const ratingLabels = {
    1: "Poor",
    2: "Fair",
    3: "Good",
    4: "Very Good",
    5: "Excellent",
  };

  const [hoverRatings, setHoverRatings] = useState(
    Object.keys(ratings).reduce((acc, aspect) => {
      acc[aspect] = 0;
      return acc;
    }, {})
  );

  // Handle hover
  const handleHover = (aspect, value) => {
    setHoverRatings((prev) => ({ ...prev, [aspect]: value }));
  };

  // Reset hover
  const resetHover = (aspect) => {
    setHoverRatings((prev) => ({ ...prev, [aspect]: 0 }));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => setImage(reader.result);
      reader.readAsDataURL(file);
    }
  };

  // --- Navigation ---
  const handleNext = () => setStep((s) => Math.min(3, s + 1));
  const handlePrev = () => {
    if (step === 1) onBack();
    else setStep((s) => s - 1);
  };

  // --- Rating Handler ---
  const handleRating = (aspect, value) => {
    setRatings((prev) => ({ ...prev, [aspect]: value }));
  };

  // --- Image Upload ---
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
    const maxSize = 1 * 1024 * 1024;
    if (!allowedTypes.includes(file.type)) {
      setMessageBox({
        visible: true,
        type: "error",
        title: "Invalid Image Format",
        text: "Only JPG and PNG images are allowed.",
      });
      return;
    }
    if (file.size > maxSize) {
      setMessageBox({
        visible: true,
        type: "error",
        title: "Image Too Large",
        text: "Image size must be under 1MB.",
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => setImage(reader.result);
    reader.readAsDataURL(file);
  };

  // --- Submit Handler ---
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedComplaint) {
      setMessageBox({
        visible: true,
        type: "error",
        title: "Missing Complaint",
        text: "Please select a complaint to link your feedback.",
      });
      return;
    }

    const hasMissingRatings = Object.values(ratings).some((r) => r === 0);
    if (hasMissingRatings) {
      setMessageBox({
        visible: true,
        type: "error",
        title: "Incomplete Rating",
        text: "Please rate all categories before submitting.",
      });
      return;
    }

    if (feedbackText.trim().length < 10) {
      setMessageBox({
        visible: true,
        type: "error",
        title: "Feedback Too Short",
        text: "Feedback must be at least 10 characters long.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const avg =
        Object.values(ratings).reduce((a, b) => a + b, 0) / Object.keys(ratings).length;

      const feedback = {
        ...(editingFeedback || {}),
        feedbackText,
        ratings,
        averageRating: parseFloat(avg.toFixed(1)),
        image,
        createdAt: editingFeedback?.createdAt || new Date().toISOString(),
        reviewed: editingFeedback?.reviewed || false,
        userId: currentUser?.uid,
        complaintId: selectedComplaint._id,
      };

      await onSubmitFeedback(feedback);
      setMessageBox({
        visible: true,
        type: "success",
        title: editingFeedback ? "Feedback Updated!" : "Feedback Submitted!",
        text: editingFeedback
          ? "Your feedback has been updated successfully."
          : "Thank you! Your feedback has been submitted successfully.",
      });

      setStep(1);
      setFeedbackText("");
      setRatings({ responseTime: 0, serviceQuality: 0, communication: 0 });
      setImage(null);
      setSelectedComplaintId("");
      setSelectedComplaint(null);
    } catch (error) {
      console.error("Feedback submission failed:", error);
      setMessageBox({
        visible: true,
        type: "error",
        title: "Submission Failed",
        text: "An error occurred while submitting feedback. Please try again later.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Framer Motion Variants ---
  const variants = {
    enter: (dir) => ({ x: dir > 0 ? 200 : -200, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir) => ({ x: dir < 0 ? 200 : -200, opacity: 0 }),
  };

  return (
    <div className="min-h-screen bg-indigo-50 py-10">
      <div className="max-w-5xl mx-auto px-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-indigo-700">
              {editingFeedback ? "Edit Feedback" : "Submit Feedback"}
            </h1>
            <p className="text-gray-600 mt-1">
              Follow the steps below to provide your valuable feedback. Your input helps us improve.
            </p>
          </div>
        </div>

        {/* --- Steps --- */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-10 border-b bg-white">
            <div className="flex justify-between items-center">
              {["User Info", "Select Complaint", "Feedback"].map((label, idx) => {
                const id = idx + 1;
                const active = step === id;
                const completed = step > id;
                return (
                  <div key={id} className="flex-1 flex flex-col items-center relative">
                    <div
                      className={`w-12 h-12 flex items-center justify-center rounded-full border-2
                        ${completed
                          ? "bg-indigo-600 border-indigo-600 text-white"
                          : active
                          ? "bg-indigo-100 border-indigo-400 text-indigo-700"
                          : "bg-gray-100 border-gray-300 text-gray-500"}
                      `}
                    >
                      {completed ? <CheckCircle className="w-6 h-6" /> : id}
                    </div>
                    <p
                      className={`mt-2 text-sm font-medium ${
                        active ? "text-indigo-700" : "text-gray-500"
                      }`}
                    >
                      {label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* --- Step Content --- */}
          <div className="p-10">
            <motion.div
              key={step}
              custom={step}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.4 }}
            >
              {/* Step 1: User Info */}
              {step === 1 && (
                <div>
                  <h2 className="text-2xl font-bold text-indigo-700 mb-6 flex items-center gap-2">
                    <User className="w-6 h-6" /> Your Information
                  </h2>

                  <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6 shadow-inner space-y-4 text-gray-700">
                    <div className="grid md:grid-cols-2 gap-4">
                      <p>
                        <strong>Full Name:</strong>{" "}
                        {currentUser?.displayName || currentUser?.name || "—"}
                      </p>
                      <p>
                        <strong>Email:</strong> {currentUser?.email || "—"}
                      </p>
                      <p>
                        <strong>Contact Number:</strong>{" "}
                        {currentUser?.contactNo && currentUser?.contactNo !== ""
                          ? currentUser.contactNo
                          : "N/A"}
                      </p>
                      <p>
                        <strong>Role:</strong>{" "}
                        {currentUser?.role
                          ? currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)
                          : "—"}
                      </p>
                      <p>
                        <strong>{currentUser?.role === "student" ? "Hostel ID" : "User ID (Auth UID)"}:</strong>{" "}
                        {currentUser?.role === "student"
                          ? currentUser?.hostelId || "—"
                          : currentUser?.uid || "—"}
                      </p>
                      {currentUser?.lastUpdated && (
                        <p>
                          <strong>Last Updated:</strong>{" "}
                          {new Date(currentUser.lastUpdated).toLocaleString()}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 p-3 bg-indigo-100 rounded-lg text-sm text-indigo-700">
                      Please ensure your profile details are accurate. You can update them in your
                      <strong> Profile Management </strong> section before submitting feedback.
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div>
                  <h2 className="text-2xl font-bold text-indigo-700 mb-6">
                    Select a Complaint to Provide Feedback
                  </h2>

                  {/* Complaint Dropdown */}
                  {loading ? (
                    <p>Loading complaints...</p>
                  ) : complaints.length === 0 ? (
                    <p>No complaints found.</p>
                  ) : (
                    <div className="space-y-3">
                      <label className="font-semibold">Select a Complaint:</label>
                      {complaints.map(c => (
                        <button
                          key={c._id}
                          onClick={() => setSelectedComplaint(c)}
                          className={`w-full text-left p-3 border rounded-lg hover:bg-indigo-50 transition ${
                            selectedComplaint?._id === c._id ? "border-indigo-600 bg-indigo-100" : "border-gray-200"
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span>{c.category}</span>
                            <span className="text-sm text-gray-500">{c.status}</span>
                          </div>
                          <div className="text-sm text-gray-600 line-clamp-2">{c.description}</div>
                        </button>
                      ))}
                    </div>
                  )}


                  {/* Show Complaint Details */}
                  {selectedComplaint && (
                    <div>
                      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 shadow-inner mb-6">
                        <h3 className="text-lg font-semibold text-indigo-800 mb-3 flex items-center gap-2">
                          Complaint Details
                        </h3>

                        <div className="mt-6 p-4 border rounded-xl bg-gray-50">
                          <h4 className="font-semibold mb-2">Complaint Details</h4>
                          <p><strong>Category:</strong> {selectedComplaint.category}</p>
                          <p><strong>Priority:</strong> {selectedComplaint.priority}</p>
                          <p><strong>Campus:</strong> {selectedComplaint.campus}</p>
                          <p><strong>Hostel:</strong> {selectedComplaint.hostel}</p>
                          <p><strong>Status:</strong> {selectedComplaint.status}</p>
                          <p className="mt-2"><strong>Description:</strong> {selectedComplaint.description}</p>
                        </div>

                        <p className="mt-3 text-gray-600 text-sm leading-relaxed">
                          <strong>Description:</strong> {selectedComplaint.description}
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedComplaint(null)}
                        className="text-red-500 text-sm underline mt-2"
                      >
                        Clear Selection
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Feedback Form */}
              {step === 3 && (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <h2 className="text-2xl font-bold text-indigo-700 mb-6 text-center">
                    Share Your Feedback
                  </h2>

                  {/* --- Ratings --- */}
                  {Object.keys(ratings).map((aspect) => (
                    <div key={aspect} className="mb-6">
                      <label
                        htmlFor={`rating-${aspect}`}
                        className="block text-lg font-semibold text-gray-700 mb-2 capitalize"
                      >
                        {aspect.replace(/([A-Z])/g, " $1")}
                      </label>

                      <div className="flex flex-col">
                        <div className="flex gap-3 items-center">
                          {[1, 2, 3, 4, 5].map((num) => (
                            <Star
                              key={num}
                              id={`rating-${aspect}-${num}`}
                              aria-label={`${aspect} rating ${num}`}
                              onMouseEnter={() => handleHover(aspect, num)}
                              onMouseLeave={() => resetHover(aspect)}
                              onClick={() => handleRating(aspect, num)}
                              className={`w-8 h-8 cursor-pointer transition-transform duration-200 ${
                                num <= (hoverRatings[aspect] || ratings[aspect])
                                  ? "text-yellow-400 fill-yellow-400 scale-110"
                                  : "text-gray-300 hover:text-yellow-300 hover:scale-105"
                              }`}
                            />
                          ))}
                        </div>

                        <span className="mt-1 text-sm text-gray-600 min-h-[1rem]">
                          {hoverRatings[aspect]
                            ? ratingLabels[hoverRatings[aspect]]
                            : ratings[aspect]
                            ? ratingLabels[ratings[aspect]]
                            : ""}
                        </span>

                        
                      </div>
                    </div>
                  ))}

                  {/* Average Rating */}
                  {Object.keys(ratings).length > 0 && (
                    <div>
                      <label
                        htmlFor={`rating-Current Average Rating`}
                        className="block text-lg font-semibold text-gray-700 mb-2 capitalize"
                      >
                        Current Average Rating:
                      </label>

                      <div className="flex flex-col">
                        {/*
                          Calculate average rating dynamically
                        */}
                        {(() => {
                          const total = Object.values(ratings).reduce((sum, val) => sum + val, 0);
                          const avgRating = total / Object.keys(ratings).length;
                          return (
                            <div className="flex items-center gap-3">
                              {/* Stars */}
                              <div className="flex gap-3 items-center">
                                {[1, 2, 3, 4, 5].map((n) => (
                                  <Star
                                    key={n}
                                    className={`w-8 h-8 cursor-pointer transition-transform duration-200 ${
                                      n <= Math.round(avgRating)
                                        ? "text-yellow-400 fill-yellow-400"
                                        : "text-gray-300"
                                    }`}
                                  />
                                ))}
                              </div>

                              {/* Numeric rating */}
                              <span className="text-gray-700 font-semibold">{avgRating.toFixed(1)}</span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Feedback Textarea with Character Count */}
                  <textarea
                    className="w-full border border-gray-200 rounded-xl p-4 h-32 focus:ring-2 focus:ring-indigo-500 resize-none text-gray-700 shadow-sm transition-all"
                    placeholder="Share your feedback here..."
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    maxLength={500}
                  />
                  <div className="flex items-center justify-between mt-1">
                    {/* Progress Bar */}
                    <div className="relative w-full h-2 bg-gray-200 rounded mr-2">
                      <div
                        className="absolute h-2 bg-indigo-600 rounded"
                        style={{ width: `${(feedbackText.length / 500) * 100}%` }}
                      />
                    </div>

                    {/* Character Count */}
                    <p className="text-sm text-gray-500 whitespace-nowrap">
                      {feedbackText.length}/500
                    </p>
                  </div>

                  {/* Image Upload */}
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-700">
                      Optional Image Attachment
                    </label>

                    {/* Hidden file input */}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      ref={fileInputRef} // use a ref to trigger click programmatically
                      className="hidden"
                    />

                    {/* Drag & Drop / Click Area */}
                    <div
                      onClick={() => fileInputRef.current.click()}
                      onDrop={handleDrop}
                      onDragOver={(e) => e.preventDefault()}
                      className="border-dashed border-2 border-gray-300 p-6 rounded-xl text-center cursor-pointer hover:bg-gray-50 transition"
                    >
                      Drag & drop an image here or click to select
                    </div>

                    {/* Preview */}
                    {image && (
                      <img
                        src={image}
                        alt="Feedback attachment preview"
                        className="mt-3 w-40 h-40 object-cover rounded-lg border border-gray-200 shadow-md transition-transform hover:scale-105"
                      />
                    )}
                  </div>

                  {/* Submit */}
                  <div className="flex justify-center space-x-4 pt-4">
                    <PrimaryButton
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-700"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader className="w-5 h-5 mr-2 inline animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Send className="w-5 h-5 mr-2 inline" />
                          {editingFeedback ? "Update Feedback" : "Submit Feedback"}
                        </>
                      )}
                    </PrimaryButton>
                  </div>
                </form>
              )}
            </motion.div>
          </div>

          {/* Step Navigation */}
          <div className="p-6 flex justify-between items-center gap-6 border-t bg-gray-50">
            <button
              onClick={handlePrev}
              className={`
                w-full py-3 px-4 font-semibold text-lg tracking-wider
                bg-gray-400 text-white rounded-xl shadow-xl
                transition duration-300 ease-in-out transform
                hover:bg-gray-500 hover:shadow-2xl active:scale-[0.98]
                disabled:bg-gray-400 disabled:shadow-none
              `}
              type="button"
            >
              <ArrowLeft className="w-5 h-5 mr-2 inline" /> Back
            </button>

            {step < 3 && (
              <PrimaryButton
                onClick={handleNext}
                className="w-full bg-indigo-600 hover:bg-indigo-700"
                type="button"
              >
                Next
              </PrimaryButton>
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
    </div>
  );
};

export default FeedbackForm;
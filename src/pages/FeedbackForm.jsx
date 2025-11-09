import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Star,
  Send,
  ArrowLeft,
  Loader,
  CheckCircle,
  AlertTriangle,
  User,
  ClipboardList,
} from "lucide-react";
import PrimaryButton from "../components/PrimaryButton";

const FeedbackForm = ({
  onBack,
  onSubmitFeedback,
  editingFeedback,
  onCancelEdit,
  currentUser,
  complaintList = [], // pass in from parent (Firestore data)
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [messageBox, setMessageBox] = useState({ visible: false, type: "", text: "" });

  // --- Step 2 (Complaint ID) ---
  const [selectedComplaintId, setSelectedComplaintId] = useState("");

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
    }
  }, [editingFeedback]);

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
        text: "Only JPG and PNG images are allowed.",
      });
      return;
    }
    if (file.size > maxSize) {
      setMessageBox({
        visible: true,
        type: "error",
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

    if (!selectedComplaintId) {
      setMessageBox({
        visible: true,
        type: "error",
        text: "Please select a complaint to link your feedback.",
      });
      return;
    }

    const hasMissingRatings = Object.values(ratings).some((r) => r === 0);
    if (hasMissingRatings) {
      setMessageBox({
        visible: true,
        type: "error",
        text: "Please rate all categories before submitting.",
      });
      return;
    }

    if (feedbackText.trim().length < 10) {
      setMessageBox({
        visible: true,
        type: "error",
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
        userName: currentUser?.displayName || "",
        complaintId: selectedComplaintId,
      };

      await onSubmitFeedback(feedback);
      setMessageBox({
        visible: true,
        type: "success",
        text: editingFeedback
          ? "Your feedback has been updated successfully."
          : "Thank you! Your feedback has been submitted successfully.",
      });

      setStep(1);
      setFeedbackText("");
      setRatings({ responseTime: 0, serviceQuality: 0, communication: 0 });
      setImage(null);
      setSelectedComplaintId("");
    } catch (error) {
      console.error("Feedback submission failed:", error);
      setMessageBox({
        visible: true,
        type: "error",
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 to-indigo-200 py-10">
      <div className="max-w-5xl mx-auto px-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-indigo-700">
              {editingFeedback ? "Edit Feedback" : "Submit Feedback"}
            </h1>
            <p className="text-gray-600 mt-1">
              Follow the steps below to complete your feedback submission.
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
                  <div className="space-y-4 text-gray-700">
                    <p>
                      <strong>Name:</strong> {currentUser?.displayName || "—"}
                    </p>
                    <p>
                      <strong>Email:</strong> {currentUser?.email || "—"}
                    </p>
                    <p>
                      <strong>User ID:</strong> {currentUser?.uid || "—"}
                    </p>
                  </div>
                </div>
              )}

              {/* Step 2: Select Complaint */}
              {step === 2 && (
                <div>
                  <h2 className="text-2xl font-bold text-indigo-700 mb-6 flex items-center gap-2">
                    <ClipboardList className="w-6 h-6" /> Select Complaint
                  </h2>
                  <p className="text-gray-600 mb-4">
                    Choose the complaint related to this feedback.
                  </p>
                  <select
                    value={selectedComplaintId}
                    onChange={(e) => setSelectedComplaintId(e.target.value)}
                    className="w-full border p-3 rounded-lg mb-4"
                  >
                    <option value="">Select a complaint</option>
                    {complaintList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {`${c.id} - ${c.category || "Complaint"}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Step 3: Feedback Form */}
              {step === 3 && (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <h2 className="text-2xl font-bold text-indigo-700 mb-6 text-center">
                    Share Your Feedback
                  </h2>

                  {/* Ratings */}
                  {Object.keys(ratings).map((aspect) => (
                    <div key={aspect}>
                      <label className="block text-lg font-semibold text-gray-700 mb-2 capitalize">
                        {aspect.replace(/([A-Z])/g, " $1")}
                      </label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((num) => (
                          <Star
                            key={num}
                            onClick={() => handleRating(aspect, num)}
                            className={`w-7 h-7 cursor-pointer transition-transform ${
                              num <= ratings[aspect]
                                ? "text-yellow-400 fill-yellow-400 scale-110"
                                : "text-gray-300 hover:text-yellow-300"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Feedback Text */}
                  <textarea
                    className="w-full border border-gray-200 rounded-xl p-4 h-32 focus:ring-2 focus:ring-indigo-500 resize-none text-gray-700 shadow-sm"
                    placeholder="Share your feedback here..."
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                  />

                  {/* Image Upload */}
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-700">
                      Optional Image Attachment
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="border border-gray-300 rounded-md p-2 w-full"
                    />
                    {image && (
                      <img
                        src={image}
                        alt="Preview"
                        className="mt-3 w-40 h-40 object-cover rounded-lg border border-gray-200 shadow"
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
          <div className="p-6 flex justify-between items-center border-t bg-gray-50">
            <PrimaryButton
              onClick={handlePrev}
              className="bg-gray-400 hover:bg-gray-500"
              type="button"
            >
              <ArrowLeft className="w-5 h-5 mr-2 inline" /> Back
            </PrimaryButton>

            {step < 3 && (
              <PrimaryButton
                onClick={handleNext}
                className="bg-indigo-600 hover:bg-indigo-700"
                type="button"
              >
                Next
              </PrimaryButton>
            )}
          </div>
        </div>

        {/* Message Box */}
        {messageBox.visible && (
          <div
            className={`fixed top-6 right-6 z-50 flex items-center gap-3 p-4 rounded-lg shadow-lg transition-all ${
              messageBox.type === "success"
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {messageBox.type === "success" ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
            <span className="font-medium">{messageBox.text}</span>
            <button
              onClick={() => setMessageBox({ ...messageBox, visible: false })}
              className="ml-3 text-sm underline hover:opacity-80"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedbackForm;
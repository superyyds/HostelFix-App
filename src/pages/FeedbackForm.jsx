import React, { useState, useEffect } from "react";
import { Star, Send, ArrowLeft, Loader, CheckCircle, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

import PrimaryButton from "../components/PrimaryButton";

const FeedbackForm = ({ onBack, onSubmitFeedback, editingFeedback, onCancelEdit }) => {
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

  useEffect(() => {
    if (editingFeedback) {
      setFeedbackText(editingFeedback.feedbackText || "");
      setRatings(editingFeedback.ratings || {
        responseTime: 0,
        serviceQuality: 0,
        communication: 0,
      });
      setImage(editingFeedback.image || null);
    }
  }, [editingFeedback]);

  const handleRating = (aspect, value) => {
    setRatings((prev) => ({ ...prev, [aspect]: value }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
      const maxSize = 1 * 1024 * 1024; // 1MB
      if (!allowedTypes.includes(file.type)) {
        setMessageBox({ visible: true, type: "error", text: "Only JPG and PNG images are allowed." });
        e.target.value = "";
        return;
      }
      if (file.size > maxSize) {
        setMessageBox({ visible: true, type: "error", text: "Image size must be under 1MB." });
        e.target.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setImage(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const validateForm = () => {
    const hasMissingRatings = Object.values(ratings).some((r) => r === 0);
    if (hasMissingRatings) {
      setMessageBox({ visible: true, type: "error", text: "Please rate all categories before submitting." });
      return false;
    }
    if (feedbackText.trim().length < 10) {
      setMessageBox({ visible: true, type: "error", text: "Feedback must be at least 10 characters long." });
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // --- VALIDATION SECTION ---
    if (!feedbackText.trim() || Object.values(ratings).some((r) => r === 0)) {
      setMessageBox({
        visible: true,
        type: "error",
        text: "Please rate all aspects and provide your feedback before submitting.",
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
        createdAt: editingFeedback?.createdAt || new Date().toLocaleString(),
        reviewed: editingFeedback?.reviewed || false,
      };

      // Save or update Firestore through your callback
      await onSubmitFeedback(feedback);

      // Show success message
      setMessageBox({
        visible: true,
        type: "success",
        text: editingFeedback
          ? "Your feedback has been updated successfully."
          : "Thank you! Your feedback has been submitted successfully.",
      });

      setTimeout(() => {
        setIsSubmitting(false);
      }, 1200);

      // Reset form
      setFeedbackText("");
      setRatings({ responseTime: 0, serviceQuality: 0, communication: 0 });
      setImage(null);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-3xl bg-white/90 backdrop-blur-md p-8 rounded-2xl shadow-xl border border-indigo-100"
      >
        <h2 className="text-3xl font-bold text-indigo-700 mb-8 text-center">
          {editingFeedback ? "Edit Your Feedback" : "Submit Your Feedback"}
        </h2>

        <form onSubmit={handleSubmit}>
          {Object.keys(ratings).map((aspect) => (
            <div key={aspect} className="mb-6">
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

          <textarea
            className="w-full border border-gray-200 rounded-xl p-4 h-32 focus:ring-2 focus:ring-indigo-500 mb-6 resize-none text-gray-700 shadow-sm"
            placeholder="Share your feedback here..."
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
          ></textarea>

          <div className="mb-6">
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

          <div className="flex justify-center space-x-4 mt-8">
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

            <PrimaryButton
              onClick={editingFeedback ? onCancelEdit : onBack}
              className="bg-gray-400 hover:bg-gray-500"
              type="button"
            >
              <ArrowLeft className="w-5 h-5 mr-2 inline" />
              {editingFeedback ? "Cancel Edit" : "Back"}
            </PrimaryButton>
          </div>
        </form>
        {messageBox.visible && (
          <div
            className={`fixed top-5 right-5 z-50 flex items-center gap-3 p-4 rounded-lg shadow-lg transition-all ${
              messageBox.type === "success" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
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
      </motion.div>
    </div>
  );
};

export default FeedbackForm;
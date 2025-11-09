import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";

import PrimaryButton from "../components/PrimaryButton";

// --- Feedback Viewer (Enhanced Analytics) ---
const FeedbackViewer = ({ feedbackList, onBack, onMarkReviewed }) => {
  // --- Compute Rating Distribution Data ---
  const data = [1, 2, 3, 4, 5].map((r) => ({
    rating: r,
    count: feedbackList.filter((f) => Math.round(f.averageRating) === r).length,
  }));

  // --- Compute Average Overall Rating ---
  const avgRating =
    feedbackList.length > 0
      ? feedbackList.reduce((sum, f) => sum + (f.averageRating || 0), 0) / feedbackList.length
      : 0;

  // --- Compute Average by Category (Response, Service, Communication) ---
  const categoryData = [
    {
      aspect: "Response Time",
      avg:
        feedbackList.length > 0
          ? feedbackList.reduce((sum, f) => sum + (f.ratings?.responseTime || 0), 0) /
            feedbackList.length
          : 0,
    },
    {
      aspect: "Service Quality",
      avg:
        feedbackList.length > 0
          ? feedbackList.reduce((sum, f) => sum + (f.ratings?.serviceQuality || 0), 0) /
            feedbackList.length
          : 0,
    },
    {
      aspect: "Communication",
      avg:
        feedbackList.length > 0
          ? feedbackList.reduce((sum, f) => sum + (f.ratings?.communication || 0), 0) /
            feedbackList.length
          : 0,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 to-indigo-200 py-10">
      <div className="max-w-7xl mx-auto px-6">
        {/* --- Header Section --- */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-indigo-700">
              Feedback Analytics
            </h1>
            <p className="text-gray-600 mt-1">
              Detailed insights into the submitted feedback.
            </p>
          </div>
          <PrimaryButton 
            onClick={onBack} 
            className="w-48 px-6 mt-4 md:mt-0 bg-indigo-600 hover:bg-indigo-700 transition-colors duration-200"
          >
            Back
          </PrimaryButton>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white shadow-2xl rounded-2xl p-10 border border-indigo-100"
        >
          {/* --- Summary Section --- */}
          <div className="grid md:grid-cols-3 gap-6 mb-10 text-center">
            <div className="bg-indigo-50 p-6 rounded-xl shadow-sm border border-gray-200">
              <p className="text-gray-500 text-sm font-medium">Total Feedbacks</p>
              <h3 className="text-3xl font-bold text-indigo-700 mt-1">
                {feedbackList.length}
              </h3>
            </div>
            <div className="bg-indigo-50 p-6 rounded-xl shadow-sm border border-gray-200">
              <p className="text-gray-500 text-sm font-medium">Average Satisfaction</p>
              <h3 className="text-3xl font-bold text-green-600 mt-1">
                {avgRating.toFixed(1)} / 5
              </h3>
            </div>
            <div className="bg-indigo-50 p-6 rounded-xl shadow-sm border border-gray-200">
              <p className="text-gray-500 text-sm font-medium">Last Updated</p>
              <h3 className="text-lg font-semibold text-gray-700 mt-1">
                {new Date().toLocaleDateString()}
              </h3>
            </div>
          </div>

          {/* --- Rating Distribution Chart --- */}
          <div className="bg-gradient-to-r from-indigo-100 to-indigo-200 p-6 rounded-2xl shadow-inner mb-10 border border-gray-200">
            <h3 className="text-xl font-semibold text-indigo-800 mb-4">
              Rating Distribution
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="rating" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#4F46E5" radius={[6, 6, 0, 0]} name="Feedback Count" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* --- Aspect Comparison Chart --- */}
          <div className="bg-gradient-to-r from-indigo-100 to-sky-200 p-6 rounded-2xl shadow-inner mb-10 border border-gray-200">
            <h3 className="text-xl font-semibold text-indigo-800 mb-4">
              Average Ratings by Aspect
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="aspect" />
                <YAxis domain={[0, 5]} />
                <Tooltip />
                <Legend />
                <Bar dataKey="avg" fill="#22C55E" radius={[6, 6, 0, 0]} name="Average Rating" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* --- Feedback List Section --- */}
          <h3 className="text-2xl font-semibold text-indigo-700 mb-5">Recent Feedback</h3>
          <div className="grid gap-5">
            {feedbackList.map((fb) => (
              <motion.div
                key={fb.id}
                whileHover={{ scale: 1.01 }}
                className="border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-all bg-white"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-gray-800 font-medium mb-1">{fb.feedbackText}</p>
                    <p className="text-gray-500 text-sm">
                      Avg: {fb.averageRating?.toFixed(1)} / 5 • {fb.createdAt}
                    </p>
                  </div>
                  {!fb.reviewed && (
                    <PrimaryButton
                      onClick={() => onMarkReviewed(fb.id)}
                      className="bg-green-500 hover:bg-green-600"
                    >
                      Mark Reviewed
                    </PrimaryButton>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default FeedbackViewer;
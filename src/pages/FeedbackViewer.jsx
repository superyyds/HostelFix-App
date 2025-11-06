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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-sky-100 p-10">
      <div className="max-w-6xl mx-auto bg-white/95 backdrop-blur-md p-10 rounded-2xl shadow-lg border border-gray-100">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold text-indigo-700">Feedback Analytics</h2>
          <PrimaryButton onClick={onBack} className="bg-gray-400 hover:bg-gray-500">
            Back
          </PrimaryButton>
        </div>

        {/* --- Summary Section --- */}
        <div className="grid md:grid-cols-3 gap-6 mb-10 text-center">
          <div className="bg-indigo-50 p-6 rounded-xl shadow-sm">
            <p className="text-gray-500 text-sm">Total Feedbacks</p>
            <h3 className="text-3xl font-bold text-indigo-700">{feedbackList.length}</h3>
          </div>
          <div className="bg-indigo-50 p-6 rounded-xl shadow-sm">
            <p className="text-gray-500 text-sm">Average Satisfaction</p>
            <h3 className="text-3xl font-bold text-green-600">
              {avgRating.toFixed(1)} / 5
            </h3>
          </div>
          <div className="bg-indigo-50 p-6 rounded-xl shadow-sm">
            <p className="text-gray-500 text-sm">Last Updated</p>
            <h3 className="text-lg font-semibold text-gray-700">
              {new Date().toLocaleDateString()}
            </h3>
          </div>
        </div>

        {/* --- Rating Distribution Chart --- */}
        <div className="bg-gradient-to-r from-indigo-100 to-indigo-200 p-4 rounded-xl shadow-inner mb-10">
          <h3 className="text-xl font-semibold text-indigo-800 mb-3">
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
        <div className="bg-gradient-to-r from-indigo-100 to-sky-200 p-4 rounded-xl shadow-inner mb-10">
          <h3 className="text-xl font-semibold text-indigo-800 mb-3">
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
        <h3 className="text-2xl font-semibold text-indigo-700 mb-4">Recent Feedback</h3>
        <div className="space-y-4">
          {feedbackList.map((fb) => (
            <motion.div
              key={fb.id}
              whileHover={{ scale: 1.01 }}
              className="border border-gray-200 p-5 rounded-xl flex justify-between items-center shadow-sm hover:shadow-md bg-white"
            >
              <div>
                <p className="text-gray-800 font-medium">{fb.feedbackText}</p>
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
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FeedbackViewer;
import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";
import { StepBack } from "lucide-react";

import PrimaryButton from "../components/PrimaryButton";

// --- Feedback Viewer (Enhanced Analytics) ---
const FeedbackViewer = ({ feedbackList, onBack, onMarkReviewed }) => {
  // Helper function to format date
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return dateString; // Return original if parsing fails
    }
  };

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
    <div className="min-h-screen bg-indigo-50 py-10">
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
          <div>
            <PrimaryButton className="w-auto mr-4" onClick={onBack}>
              <div className="flex items-center justify-center"><StepBack className="w-5 h-5 mr-2" />Back</div>
            </PrimaryButton>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"
        >
          {/* --- Summary Section --- */}
          <div className="grid md:grid-cols-3 gap-6 mb-10 text-center">
            <div className="bg-indigo-50 p-6 rounded-xl shadow-sm border border-indigo-100">
              <p className="text-gray-500 text-sm font-medium">Total Feedbacks</p>
              <h3 className="text-3xl font-bold text-indigo-700 mt-1">
                {feedbackList.length}
              </h3>
            </div>
            <div className="bg-green-50 p-6 rounded-xl shadow-sm border border-green-100">
              <p className="text-gray-500 text-sm font-medium">Average Satisfaction</p>
              <h3 className="text-3xl font-bold text-green-600 mt-1">
                {avgRating.toFixed(1)} / 5
              </h3>
            </div>
            <div className="bg-gray-50 p-6 rounded-xl shadow-sm border border-gray-200">
              <p className="text-gray-500 text-sm font-medium">Last Updated</p>
              <h3 className="text-lg font-semibold text-gray-700 mt-1">
                {new Date().toLocaleDateString()}
              </h3>
            </div>
          </div>

          {/* --- Charts Section --- */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
            {/* --- Rating Distribution Chart --- */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 h-full flex flex-col">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                Rating Distribution
              </h3>
              <div className="flex-grow">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="rating" />
                    <YAxis />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                      cursor={{ fill: '#eef2ff' }}
                    />
                    <Legend />
                    <Bar dataKey="count" fill="#4F46E5" radius={[6, 6, 0, 0]} name="Feedback Count" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* --- Aspect Comparison Chart --- */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 h-full flex flex-col">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                Average Ratings by Aspect
              </h3>
              <div className="flex-grow">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={categoryData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="aspect" />
                    <YAxis domain={[0, 5]} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                      cursor={{ fill: '#eef2ff' }}
                      formatter={(value) => [value.toFixed(2), 'Average Rating']}
                    />
                    <Legend />
                    <Bar dataKey="avg" fill="#4ADE80" radius={[6, 6, 0, 0]} name="Average Rating" barSize={70} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* --- Feedback List Section --- */}
          <h3 className="text-2xl font-semibold text-indigo-700 mb-5">Recent Feedback</h3>
          <div className="grid gap-5">
            {feedbackList.map((fb) => (
              <motion.div
                key={fb.id}
                className="border border-gray-200 rounded-xl p-6 shadow-sm transition-all bg-white hover:bg-indigo-50 group hover:border-indigo-300"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-gray-800 font-medium mb-1 transition-colors">{fb.feedbackText}</p>
                    <p className="text-gray-500 text-sm">
                      Avg: {fb.averageRating?.toFixed(1)} / 5 • {formatDate(fb.createdAt)}
                    </p>
                  </div>
                  {!fb.reviewed && (
                    <PrimaryButton
                      onClick={() => onMarkReviewed(fb.id)}
                      className="bg-green-500 hover:bg-green-600 !w-auto !py-4 !px-4 !text-sm !font-semibold"
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
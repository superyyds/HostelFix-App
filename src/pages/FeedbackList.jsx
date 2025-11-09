import React, { useState } from "react";
import { Star } from "lucide-react";
import { motion } from "framer-motion";

import PrimaryButton from "../components/PrimaryButton";

// --- Feedback List ---
const FeedbackList = ({ feedbackList, onBack, onDeleteFeedback, onEditFeedback }) => {
  const [filterRating, setFilterRating] = useState("all");
  const clearFilter = () => setFilterRating("all");

  const filtered =
    filterRating === "all"
      ? feedbackList
      : feedbackList.filter((f) => Math.floor(f.averageRating) >= parseInt(filterRating));

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 to-indigo-200 py-10">
      <div className="max-w-7xl mx-auto px-6">
        {/* --- Header Section --- */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-indigo-700">
              My Feed
            </h1>
            <p className="text-gray-600 mt-1">
              View, edit, or delete your submitted feedback.
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
          {/* Filter Section */}
          <div className="flex flex-wrap justify-end items-center gap-3 mb-8">
            <select
              className="border border-gray-300 rounded-xl px-4 py-2 bg-gray-50 text-gray-700 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
              value={filterRating}
              onChange={(e) => setFilterRating(e.target.value)}
            >
              <option value="all">All Ratings</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}+ Stars
                </option>
              ))}
            </select>
            {filterRating !== "all" && (
              <button
                onClick={clearFilter}
                className="text-sm text-red-500 hover:text-red-700 font-medium underline"
              >
                Clear Filter
              </button>
            )}
          </div>

          {/* Feedback List */}
          {filtered.length === 0 ? (
            <p className="text-gray-500 text-center mt-10 text-lg font-medium">
              No feedback available.
            </p>
          ) : (
            <div className="grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filtered.map((fb) => (
                <motion.div
                  key={fb.id}
                  whileHover={{ scale: 1.02 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-2xl border border-gray-200 bg-white p-6 shadow-md hover:shadow-lg transition-all duration-200"
                >
                  {/* Rating & Date */}
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-5 h-5 ${
                            i < Math.round(fb.averageRating)
                              ? "text-yellow-400 fill-yellow-400"
                              : "text-gray-300"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-gray-400 text-sm">{fb.createdAt}</span>
                  </div>

                  {/* Feedback Text */}
                  <p className="text-gray-700 leading-relaxed mb-4 text-base">
                    {fb.feedbackText}
                  </p>

                  {/* Image (Optional) */}
                  {fb.image && (
                    <div className="flex justify-center mb-4">
                      <img
                        src={fb.image}
                        alt="Feedback attachment"
                        className="w-40 h-40 object-cover rounded-xl shadow-sm border border-gray-200"
                      />
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex justify-center gap-6 text-sm font-semibold">
                    <button
                      onClick={() => onEditFeedback(fb)}
                      className="text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDeleteFeedback(fb.id)}
                      className="text-red-500 hover:text-red-700 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default FeedbackList;
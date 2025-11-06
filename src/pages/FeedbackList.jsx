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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 p-10">
      <div className="max-w-5xl mx-auto bg-white/95 backdrop-blur-md p-10 rounded-2xl shadow-lg border border-gray-100">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-indigo-700">My Feedback</h2>
          <PrimaryButton onClick={onBack} className="bg-gray-400 hover:bg-gray-500">
            Back
          </PrimaryButton>
        </div>

        <div className="flex justify-end items-center gap-3 mb-5">
          <select
            className="border border-gray-300 rounded-lg px-3 py-2 text-gray-700 bg-gray-50 shadow-sm"
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
              className="text-sm text-red-500 hover:underline font-medium"
            >
              Clear Filter
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <p className="text-gray-500 text-center mt-8">No feedback available.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {filtered.map((fb) => (
              <motion.div
                key={fb.id}
                whileHover={{ scale: 1.02 }}
                className="border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all bg-white"
              >
                <div className="flex justify-between mb-2 items-center">
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
                  <p className="text-gray-400 text-sm">{fb.createdAt}</p>
                </div>

                <p className="text-gray-700 mb-3 leading-relaxed">{fb.feedbackText}</p>
                {fb.image && (
                  <img
                    src={fb.image}
                    alt="Feedback attachment"
                    className="w-32 h-32 object-cover rounded-lg mb-3 shadow-sm"
                  />
                )}

                <div className="flex space-x-4 text-sm font-medium">
                  <button
                    onClick={() => onEditFeedback(fb)}
                    className="text-blue-500 hover:text-blue-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDeleteFeedback(fb.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedbackList;
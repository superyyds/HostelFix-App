import React, { useState, useEffect, useMemo } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { Filter, SortAsc, MapPin, Home, StepBack } from "lucide-react";

import { db } from "../api/firebase"; 
import PrimaryButton from "../components/PrimaryButton";

const STATUS = { PENDING: 'Pending', IN_PROGRESS: 'In Progress', RESOLVED: 'Resolved' };

const ComplaintList = ({ currentUser, onSelect, onBack }) => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    category: "",
    campus: "",
    status: "",
  });
  const [sortBy, setSortBy] = useState("date");

  // Real-time listener for Firestore complaints
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "complaints"), (snapshot) => {
      let data = snapshot.docs.map((doc) => ({
        _id: doc.id,
        ...doc.data(),
      }));

      // Filter by user role
      if (currentUser?.role === "student") {
        data = data.filter((c) => c.userId === currentUser.uid);
      }
      else if (currentUser?.role === "staff") {
        data = data.filter((c) => c.assignedTo === currentUser.uid);
      }

      setList(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Filtering + Sorting
  const filtered = useMemo(() => {
    let result = [...list];
    if (filters.category) result = result.filter((c) => c.category === filters.category);
    if (filters.campus) result = result.filter((c) => c.campus === filters.campus);
    if (filters.status) result = result.filter((c) => c.status === filters.status);

    if (sortBy === "urgency") {
      const order = { High: 1, Medium: 2, Low: 3 };
      result.sort((a, b) => order[a.priority] - order[b.priority]);
    } else {
        result.sort((a, b) => {
        // Handle Firestore Timestamp objects
        const getDate = (complaint) => {
          if (!complaint.dateSubmitted) return new Date(0); // Fallback for missing dates
          
          // If it's a Firestore Timestamp object
          if (complaint.dateSubmitted.toDate && typeof complaint.dateSubmitted.toDate === 'function') {
            return complaint.dateSubmitted.toDate();
          }
          
          // If it's already a Date object
          if (complaint.dateSubmitted instanceof Date) {
            return complaint.dateSubmitted;
          }
          
          // If it's a string or ISO string
          return new Date(complaint.dateSubmitted);
        };

        const dateA = getDate(a);
        const dateB = getDate(b);
        
        // Sort in descending order (newest first)
        return dateB.getTime() - dateA.getTime();
      });
    }
    return result;
  }, [list, filters, sortBy]);

  const categoryOptions = [...new Set(list.map((c) => c.category))];
  const campusOptions = [...new Set(list.map((c) => c.campus))];

  // UI Render
  return (
    <div className="min-h-screen bg-indigo-50 py-10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-indigo-700">
              {currentUser?.role === "warden"
                ? "All Registered Complaints"
                : currentUser?.role === "staff"
                ? "Assigned Complaints"
                : "Your Registered Complaints"}
            </h1>
            <p className="text-gray-600 mt-1">
              {currentUser?.role === "warden"
                ? "Monitor and manage the student complaints."
                : currentUser?.role === "staff"
                ? "View and address your assigned complaints."
                : "Track your submitted complaints and their statuses."}
            </p>
          </div>
          <div>
            <PrimaryButton className="w-auto mr-4" onClick={onBack}>
              <div className="flex items-center justify-center"><StepBack className="w-5 h-5 mr-2" />Back</div>
            </PrimaryButton>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          {/* Filters */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-3">
            <div className="flex flex-wrap gap-3 text-sm items-center">
              <div className="flex items-center gap-2 text-gray-500 font-medium">
                <Filter className="w-4 h-4" />
                <span>Filter:</span>
              </div>

              <select
                className="px-3 py-2 border rounded-lg bg-gray-50 text-gray-700 hover:bg-white focus:ring-2 focus:ring-indigo-400"
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              >
                <option value="">All Categories</option>
                {categoryOptions.map((cat) => (
                  <option key={cat}>{cat}</option>
                ))}
              </select>

              <select
                className="px-3 py-2 border rounded-lg bg-gray-50 text-gray-700 hover:bg-white focus:ring-2 focus:ring-indigo-400"
                value={filters.campus}
                onChange={(e) => setFilters({ ...filters, campus: e.target.value })}
              >
                <option value="">All Campuses</option>
                {campusOptions.map((campus) => (
                  <option key={campus}>{campus}</option>
                ))}
              </select>

              <select
                className="px-3 py-2 border rounded-lg bg-gray-50 text-gray-700 hover:bg-white focus:ring-2 focus:ring-indigo-400"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <option value="">All Status</option>
                {Object.values(STATUS).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>

              <div className="flex items-center gap-2 ml-2 text-gray-500 font-medium">
                <SortAsc className="w-4 h-4" />
                <span>Sort:</span>
              </div>

              <select
                className="px-3 py-2 border rounded-lg bg-gray-50 text-gray-700 hover:bg-white focus:ring-2 focus:ring-indigo-400"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="date">Latest</option>
                <option value="urgency">Priority</option>
              </select>
            </div>
          </div>

          {/* Complaint List */}
          {loading ? (
          <p className="text-center text-gray-500 italic py-10">Loading complaints...</p>
          ) :  filtered.length === 0 ? (
            <p className="text-gray-500 text-center py-10 italic">
              No complaints found.
            </p>
          ) : (
            <div className="space-y-4">
              {filtered.map((c) => (
                <button
                  key={c._id}
                  onClick={() => onSelect(c)}
                  className="group w-full text-left p-5 rounded-xl border border-gray-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 transition-all duration-300 flex justify-between items-start shadow-sm hover:shadow-md"
                >
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-semibold text-gray-800 group-hover:text-indigo-700">
                          {c.category}
                        </span>
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                            c.priority === "High"
                              ? "border border-red-700 text-red-700"
                              : c.priority === "Medium"
                              ? "border border-yellow-700 text-yellow-700"
                              : "border border-green-700 text-green-700"
                          }`}
                        >
                          {c.priority}
                        </span>
                      </div>
                      <span
                        className={`text-sm px-5 py-2 rounded-lg font-semibold uppercase tracking-wide ${
                          c.status === STATUS.PENDING
                            ? "bg-yellow-100 text-yellow-700"
                            : c.status === STATUS.IN_PROGRESS
                            ? "bg-blue-100 text-blue-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-4 mb-3 text-sm text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-indigo-500" />
                        <span>{c.campus}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Home className="w-4 h-4 text-indigo-500" />
                        <span>{c.hostel}</span>
                      </div>
                    </div>

                    <div className="text-gray-700 text-sm leading-relaxed mb-3 line-clamp-3 py-3">
                      {c.description}
                    </div>

                    <div className="text-xs text-gray-400 flex justify-between">
                      <span>{c.userName}</span>
                      <span>
                        {c.dateSubmitted?.toDate
                          ? c.dateSubmitted.toDate().toLocaleString()
                          : new Date(c.dateSubmitted).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

 export default ComplaintList;
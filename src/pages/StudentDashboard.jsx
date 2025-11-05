// src/pages/StudentDashboard.jsx

import React from 'react';
import { LogOut, Settings, AlertTriangle, MessageSquare, Shield } from "lucide-react";

// --- Import UI Components ---
import PrimaryButton from '../components/PrimaryButton';
import DashboardCard from '../components/DashboardCard';

const StudentDashboard = ({ onLogout, userId, userDocId, userRole, onViewChange }) => (
    <div className="p-8 bg-indigo-50 min-h-screen font-['Poppins']">
        <div className="max-w-7xl mx-auto">
            <h1 className="text-3xl font-extrabold text-indigo-700 mb-6 border-b pb-2">Student Portal - HostelFix</h1>
            <div className="bg-white p-6 rounded-2xl shadow-xl mb-8 flex justify-between items-center">
                <div>
                    <p className="text-lg text-gray-700">Welcome, Student! Get started by submitting a new complaint.</p>
                    <p className="text-xs text-gray-500 mt-1">Hostel ID: {userDocId} | Auth UID: {userId} | Role: {userRole}</p>
                </div>
                <div className="flex items-center">
                    <button
                        onClick={() => onViewChange('profile-management')}
                        className="mr-4 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition"
                        title="Profile Settings"
                    >
                        <Settings className="w-5 h-5 text-gray-600" />
                    </button>
                    <PrimaryButton onClick={onLogout} className="w-auto px-6 bg-red-500 hover:bg-red-600 ml-4">
                        <div className="flex items-center justify-center"><LogOut className="w-5 h-5 mr-2" /> Log Out</div>
                    </PrimaryButton>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <DashboardCard
                    icon={AlertTriangle}
                    title="Register Complaint"
                    description="Log a new issue with room or facilities (Module 2)."
                    color="text-red-500"
                />
                <DashboardCard
                    icon={MessageSquare}
                    title="Complaint Tracking"
                    description="View status (Pending, Resolved) and history."
                    color="text-blue-500"
                />
                <DashboardCard
                    icon={Shield}
                    title="View Announcements"
                    description="Warden updates and maintenance schedules."
                    color="text-green-500"
                />
            </div>
        </div>
    </div>
);

export default StudentDashboard;
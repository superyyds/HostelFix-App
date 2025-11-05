// src/pages/WardenDashboard.jsx

import React from 'react';
import { LogOut, Settings, AlertTriangle, MessageSquare, BarChart3, Users } from "lucide-react";

// --- Import UI Components ---
import PrimaryButton from '../components/PrimaryButton';
import DashboardCard from '../components/DashboardCard';

const WardenDashboard = ({ onLogout, userId, userDocId, userRole, onViewChange }) => (
    <div className="p-8 bg-gray-100 min-h-screen font-['Poppins']">
        <div className="max-w-7xl mx-auto">
            <h1 className="text-3xl font-extrabold text-gray-800 mb-6 border-b pb-2">Warden Portal - HostelFix Management</h1>
            <div className="bg-white p-6 rounded-2xl shadow-xl mb-8 flex justify-between items-center">
                <div>
                    <p className="text-lg text-gray-700">Welcome, Warden/Staff! Use the tools below to manage and resolve facility issues.</p>
                    <p className="text-xs text-gray-500 mt-1">Firestore Doc ID: {userDocId} | Auth UID: {userId} | Role: {userRole}</p>
                </div>
                <div className="flex items-center">
                    <button
                        onClick={() => onViewChange('register-user')}
                        className="mr-4 p-2 rounded-full bg-green-100 hover:bg-green-200 transition text-green-600 font-semibold"
                        title="Register New User"
                    >
                        <Users className="w-5 h-5 text-green-600" />
                    </button>
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
                    title="New Complaints (5)"
                    description="Review and assign unhandled issues (Module 2)."
                />
                <DashboardCard
                    icon={MessageSquare}
                    title="Feedback Review"
                    description="Analyze student satisfaction ratings (Module 3)."
                />
                <DashboardCard
                    icon={BarChart3}
                    title="Generate Reports"
                    description="Quarterly analytics on resolution times (Module 4)."
                />
            </div>
        </div>
    </div>
);

export default WardenDashboard;
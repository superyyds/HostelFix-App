import React from 'react';
import { LogOut, Settings, MessageSquare, Shield, Home, AlertCircle } from "lucide-react";

// --- Import UI Components ---
import PrimaryButton from '../components/PrimaryButton';
import DashboardCard from '../components/DashboardCard';
import NotificationBell from '../components/NotificationBell';

const StaffDashboard = ({ onLogout, name, userRole, onViewChange, userId, staffWardenId, onNotificationClick }) => {
    // 🔑 ROLE VALIDATION - Only staff can access
    if (userRole !== 'staff') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 p-6">
                <AlertCircle className="w-16 h-16 text-red-600 mb-4" />
                <h2 className="text-2xl font-bold text-red-800 mb-2">Access Denied</h2>
                <p className="text-red-700 text-center mb-6">
                    This dashboard is only accessible to staff accounts. 
                    Your role is: <strong>{userRole.charAt(0).toUpperCase() + userRole.slice(1)}</strong>
                </p>
                <PrimaryButton onClick={onLogout} className="bg-red-600 hover:bg-red-700">
                    <LogOut className="w-5 h-5 mr-2" /> Back to Login
                </PrimaryButton>
            </div>
        );
    }

    return (
        <div className="bg-gray-100 min-h-screen">
        <div className="flex items-center bg-indigo-50 p-4 shadow-xl mb-8 px-10">
            <div className="flex items-center flex-grow">
                <img
                    src={"../public/logo.png"}
                    alt={"HostelFix Logo"}
                    className="h-14 w-auto"
                />
                <h1 className="text-2xl font-extrabold ml-3">
                    Staff Portal {/* Differentiate the portal name */}
                </h1>
            </div>
            
            <div className="flex items-center gap-6 mr-6">
                {/* Notification Bell */}
                <NotificationBell 
                    userId={userId} 
                    onNotificationClick={onNotificationClick}
                />
                
                <button
                    onClick={() => onViewChange('profile-management')}
                    className="p-1.5 rounded-full hover:bg-gray-200 transition"
                    title="Profile Settings"
                >
                    <Settings className="w-8 h-8 text-gray-600" />
                </button>
                <PrimaryButton onClick={onLogout} className="w-auto px-6 bg-red-500 hover:bg-red-600">
                    <div className="flex items-center justify-center"><LogOut className="w-5 h-5 mr-2" /> Log Out</div>
                </PrimaryButton>
            </div>
        </div>
        
        <div className="max-w-[120rem] mx-auto px-4 sm:px-10 md:px-20">
            <div className="bg-white rounded-2xl shadow-xl mb-8 flex items-stretch overflow-hidden">
                <div className="flex-shrink-0 w-[10rem] bg-gradient-to-b from-indigo-600 to-blue-500 flex items-center justify-center">
                    <Home className="w-14 h-14 text-indigo-100" />
                </div>
                
                <div className="flex-1 px-12 py-6">
                    <h2 className="text-2xl font-bold text-gray-800">
                    Welcome, {name}!
                    </h2>
                    <p className="text-lg text-gray-600 mt-3">
                    Staff ID : <span className="font-medium text-indigo-700">{staffWardenId}</span>
                    <span className="mx-2">|</span>
                    Role : <span className="font-medium text-indigo-700">{userRole.charAt(0).toUpperCase() + userRole.slice(1)}</span>
                    </p>
                    <p className="text-lg text-gray-500 mt-3">
                    View and address your assigned complaints.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <DashboardCard 
                    icon={MessageSquare} 
                    title="Assigned Complaints" 
                    description="View your complaint status and history." 
                    color="text-blue-500"
                    onClick={() => onViewChange('complaintList')}
                />
                <DashboardCard 
                    icon={Shield} 
                    title="View Announcements" 
                    description="See warden updates and maintenance schedules." 
                    color="text-green-500" 
                />
            </div>
        </div>
    </div>
    );
}

export default StaffDashboard;
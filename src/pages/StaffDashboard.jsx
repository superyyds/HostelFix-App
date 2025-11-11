import React from 'react';
import { LogOut, Settings, MessageSquare, Shield, Home } from "lucide-react";

// --- Import UI Components ---
import PrimaryButton from '../components/PrimaryButton';
import DashboardCard from '../components/DashboardCard';

const StaffDashboard = ({ onLogout, name, userRole, onViewChange }) => (
    <div className="bg-gray-100 min-h-screen">
        <div className="flex items-center bg-white p-4 shadow-xl mb-8 px-10">
            <div className="flex items-center flex-grow">
                <img
                    src={"../public/logo.png"}
                    alt={"HostelFix Logo"}
                    className="h-14 w-auto"
                />
                <h1 className="text-2xl font-extrabold text-indigo-700 ml-3">
                    HostelFix <span className="text-gray-500">- Staff Portal</span> {/* Differentiate the portal name */}
                </h1>
            </div>
            
            <div className="flex items-center">
                <button
                    onClick={() => onViewChange('profile-management')}
                    className="mr-4 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition"
                    title="Profile Settings"
                >
                    <Settings className="w-8 h-8 text-gray-600" />
                </button>
                <PrimaryButton onClick={onLogout} className="w-auto px-6 bg-red-500 hover:bg-red-600 ml-4">
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
                    Role : <span className="font-medium text-indigo-700">{userRole}</span>
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

export default StaffDashboard;
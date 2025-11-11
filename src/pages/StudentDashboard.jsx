import React from 'react';
import { LogOut, Settings, AlertTriangle, MessageSquare, Shield, Star, AlertCircle } from "lucide-react";
import PrimaryButton from '../components/PrimaryButton';
import DashboardCard from '../components/DashboardCard';

const StudentDashboard = ({ onLogout, name, hostelId, userRole, onViewChange }) => {
    // 🔑 ROLE VALIDATION - Only students can access
    if (userRole !== 'student') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 p-6">
                <AlertCircle className="w-16 h-16 text-red-600 mb-4" />
                <h2 className="text-2xl font-bold text-red-800 mb-2">Access Denied</h2>
                <p className="text-red-700 text-center mb-6">
                    This dashboard is only accessible to student accounts. 
                    Your role is: <strong>{userRole}</strong>
                </p>
                <PrimaryButton onClick={onLogout} className="bg-red-600 hover:bg-red-700">
                    <LogOut className="w-5 h-5 mr-2" /> Back to Login
                </PrimaryButton>
            </div>
        );
    }

    return (
        <div className="p-8 bg-gray-100 min-h-screen">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-extrabold text-gray-800 mb-6 border-b pb-2">Student Portal - HostelFix</h1>
                <div className="bg-white p-6 rounded-2xl shadow-xl mb-8 flex justify-between items-center">
                    <div>
                        <p className="text-xl text-gray-700">Welcome, {name}! Get started by submitting a new complaint.</p>
                        <p className="text-lg text-gray-500 mt-1">Hostel ID: {hostelId} | Role: {userRole}</p>
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
                        description="Log a new issue with your room or facilities." 
                        color="text-red-500"
                        onClick={() => onViewChange('complaintForm')}
                    />
                    <DashboardCard 
                        icon={MessageSquare} 
                        title="Complaint Tracking" 
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
                    <DashboardCard
                        icon={Shield}
                        title="Submit Feedback"
                        description="Share your thoughts on how your complaint was handled."
                        color="text-green-500"
                        onClick={() => onViewChange('feedbackForm')}
                    />
                    <DashboardCard
                        icon={Star}
                        title="My Feedback"
                        description="View and manage your submitted feedback."
                        color="text-yellow-500"
                        onClick={() => onViewChange('studentFeedbackList')}
                    />
                </div>
            </div>
        </div>
    );
};

export default StudentDashboard;

// // src/pages/StudentDashboard.jsx

// import React from 'react';
// import { LogOut, Settings, AlertTriangle, MessageSquare, Shield, Star } from "lucide-react";

// // --- Import UI Components ---
// import PrimaryButton from '../components/PrimaryButton';
// import DashboardCard from '../components/DashboardCard';

// const StudentDashboard = ({ onLogout, name, hostelId, userRole, onViewChange }) => (
//     <div className="p-8 bg-gray-100 min-h-screen">
//         <div className="max-w-7xl mx-auto">
//             <h1 className="text-3xl font-extrabold text-gray-800 mb-6 border-b pb-2">Student Portal - HostelFix</h1>
//             <div className="bg-white p-6 rounded-2xl shadow-xl mb-8 flex justify-between items-center">
//                 <div>
//                     <p className="text-xl text-gray-700">Welcome, {name}! Get started by submitting a new complaint.</p>
//                     <p className="text-lg text-gray-500 mt-1">Hostel ID: {hostelId} | Role: {userRole}</p>
//                 </div>
//                 <div className="flex items-center">
//                     <button
//                         onClick={() => onViewChange('profile-management')}
//                         className="mr-4 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition"
//                         title="Profile Settings"
//                     >
//                         <Settings className="w-5 h-5 text-gray-600" />
//                     </button>
//                     <PrimaryButton onClick={onLogout} className="w-auto px-6 bg-red-500 hover:bg-red-600 ml-4">
//                         <div className="flex items-center justify-center"><LogOut className="w-5 h-5 mr-2" /> Log Out</div>
//                     </PrimaryButton>
//                 </div>
//             </div>
//             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
//                 <DashboardCard 
//                     icon={AlertTriangle} 
//                     title="Register Complaint" 
//                     description="Log a new issue with your room or facilities." 
//                     color="text-red-500"
//                     onClick={() => onViewChange('complaintForm')}
//                 />
//                 <DashboardCard 
//                     icon={MessageSquare} 
//                     title="Complaint Tracking" 
//                     description="View your complaint status and history." 
//                     color="text-blue-500"
//                     onClick={() => onViewChange('complaintList')}
//                 />
//                 <DashboardCard 
//                     icon={Shield} 
//                     title="View Announcements" 
//                     description="See warden updates and maintenance schedules." 
//                     color="text-green-500" 
//                 />
//                 <DashboardCard
//                     icon={Shield}
//                     title="Submit Feedback"
//                     description="Share your thoughts on how your complaint was handled."
//                     color="text-green-500"
//                     onClick={() => onViewChange('feedbackForm')}
//                 />
//                 <DashboardCard
//                     icon={Star}
//                     title="My Feedback"
//                     description="View and manage your submitted feedback."
//                     color="text-yellow-500"
//                     onClick={() => onViewChange('studentFeedbackList')}
//                 />
//             </div>
//         </div>
//     </div>
// );

// export default StudentDashboard;
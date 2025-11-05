// src/pages/ProfileManagementPage.jsx

import React, { useState } from "react";
import { User, Briefcase, Shield, Mail, Phone, ArrowLeft, Lock, Loader2 } from "lucide-react";

// --- Import UI Components ---
import PrimaryButton from '../components/PrimaryButton';
import InputField from '../components/InputField';
import MessageBox from '../components/MessageBox';

import { auth, updateUserInFirestore } from '../api/firebase';

const ProfileManagementPage = ({ appState, onBackToDashboard, onPasswordChange }) => {
    const [profileData, setProfileData] = useState(appState.userData || {
        name: "Loading Name...",
        email: auth.currentUser?.email || "user@example.com",
        contactNo: "",
        hostelId: appState.userDocId,
        role: appState.role,
    });

    const [isEditing, setIsEditing] = useState(false);
    const [isMessageVisible, setIsMessageVisible] = useState(false);
    const [message, setMessage] = useState({ title: "", text: "", type: "" });
    const [isLoading, setIsLoading] = useState(false);

    const primaryIdLabel = appState.role === 'student' ? 'Hostel ID' : 'User ID (Auth UID)';
    const primaryIdValue = appState.role === 'student' ? profileData.hostelId : appState.userId;

    const handleFieldChange = (e) => {
        const { name, value } = e.target;
        setProfileData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        setIsLoading(true);

        try {
            if (!profileData.name || !profileData.email) {
                throw new Error("Name and Email cannot be empty.");
            }

            await updateUserInFirestore(appState.userDocId, {
                name: profileData.name,
                contactNo: profileData.contactNo,
                lastUpdated: new Date().toISOString()
            });

            setMessage({
                title: "Profile Saved",
                text: "Your contact details have been updated.",
                type: "success"
            });
            setIsEditing(false);

        } catch (error) {
            console.error("Save profile error:", error);
            setMessage({
                title: "Save Failed",
                text: error.message || "Failed to update profile data.",
                type: "error"
            });
        }
        setIsLoading(false);
        setIsMessageVisible(true);
    };

    const closeMessage = () => setIsMessageVisible(false);

    return (
        <div className="p-8 bg-gray-100 min-h-screen font-['Poppins']">
            {isMessageVisible && (
                <MessageBox title={message.title} text={message.text} type={message.type} onClose={closeMessage} />
            )}
            <div className="max-w-3xl mx-auto w-full">
                <div className="flex items-center justify-between mb-6 border-b pb-4">
                    <button onClick={onBackToDashboard} className="text-indigo-600 hover:text-indigo-800 transition flex items-center">
                        <ArrowLeft className="w-5 h-5 mr-2" /> Back to Dashboard
                    </button>
                    <h1 className="text-3xl font-extrabold text-gray-800">User Profile</h1>
                </div>

                <div className="bg-white p-8 rounded-3xl shadow-2xl">
                    <div className="flex justify-between items-start mb-6 px-4">
                        <h2 className="text-2xl font-bold text-indigo-700">Personal Details</h2>

                        {isEditing ? (
                            <div className="flex space-x-3">
                                <PrimaryButton
                                    onClick={handleSave}
                                    className="w-auto px-6 py-2 text-sm bg-green-500 hover:bg-green-600"
                                    disabled={isLoading}
                                >
                                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                                </PrimaryButton>
                                <button 
                                    onClick={() => setIsEditing(false)} 
                                    className="w-auto px-6 py-2 text-sm font-semibold text-gray-700 bg-gray-200 rounded-xl hover:bg-gray-300 transition duration-300 disabled:bg-gray-400"
                                    disabled={isLoading}
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <PrimaryButton
                                onClick={() => setIsEditing(true)}
                                className="w-auto px-6 py-2 text-sm bg-indigo-500 hover:bg-indigo-600"
                            >
                                Edit Profile
                            </PrimaryButton>
                        )}
                    </div>
                    <form>
                        <InputField
                            icon={User}
                            type="text"
                            placeholder="Full Name"
                            name="name"
                            value={profileData.name}
                            onChange={handleFieldChange}
                            readOnly={!isEditing}
                        />

                        <InputField
                            icon={Briefcase}
                            type="text"
                            placeholder="Role"
                            value={profileData.role ? profileData.role.charAt(0).toUpperCase() + profileData.role.slice(1) : appState.role.charAt(0).toUpperCase() + appState.role.slice(1)}
                            readOnly={true}
                        />

                        <InputField
                            icon={Shield}
                            type="text"
                            placeholder={primaryIdLabel}
                            value={primaryIdValue}
                            readOnly={true}
                        />

                        <InputField
                            icon={Mail}
                            type="email"
                            placeholder="Email Address"
                            value={profileData.email}
                            readOnly={true}
                        />

                        <InputField
                            icon={Phone}
                            type="tel"
                            placeholder="Contact Number (Optional)"
                            name="contactNo"
                            value={profileData.contactNo}
                            onChange={handleFieldChange}
                            readOnly={!isEditing}
                            optional={true}
                        />
                    </form>

                    <div className="mt-8 border-t pt-6">
                        <h2 className="text-xl font-bold text-gray-800 mb-4">Security</h2>
                        <PrimaryButton
                            onClick={onPasswordChange}
                            className="w-full bg-red-500 hover:bg-red-600"
                        >
                            <div className="flex items-center justify-center">
                                <Lock className="w-5 h-5 mr-2" /> Change Password
                            </div>
                        </PrimaryButton>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfileManagementPage;
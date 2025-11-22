import React, { useState, useEffect } from "react";
import { User, Briefcase, Shield, Mail, Phone, ArrowLeft, Lock, Loader2 } from "lucide-react";

// --- Import UI Components ---
import PrimaryButton from '../components/PrimaryButton';
import InputField from '../components/InputField';
import MessageBox from '../components/MessageBox';

import { auth, updateUserInFirestore } from '../api/firebase';

const ProfileManagementPage = ({ appState, onBackToDashboard, onPasswordChange, onProfileUpdated }) => {
    const [profileData, setProfileData] = useState({
        name: appState.userData?.name || "Loading Name...",
        email: appState.userData?.email || auth.currentUser?.email || "",
        contactNo: appState.userData?.contactNo || "",
        hostelId: appState.userDocId,
        role: appState.userData?.role || appState.role,
    });

    const [isEditing, setIsEditing] = useState(false);
    const [isMessageVisible, setIsMessageVisible] = useState(false);
    const [message, setMessage] = useState({ title: "", text: "", type: "" });
    const [isLoading, setIsLoading] = useState(false);

    const primaryIdLabel = appState.role === 'student' ? 'Hostel ID' : 'User ID (Auth UID)';
    const primaryIdValue = appState.role === 'student' ? profileData.hostelId : appState.userId;

    useEffect(() => {
        if (appState.userData) {
            setProfileData(prev => ({
                ...prev,
                name: appState.userData.name || prev.name,
                email: appState.userData.email || prev.email,
                contactNo: appState.userData.contactNo || prev.contactNo,
                role: appState.userData.role || prev.role
            }));
        }
    }, [appState.userData]);

    const handleFieldChange = (e) => {
        const { name, value } = e.target;
        console.log('Field changed:', name, value); // Debug log
        setProfileData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        setIsLoading(true);

        const prevData = profileData;
        const trimmedName = (profileData.name || '').trim();
        const normalizedContact = (profileData.contactNo === 'N/A' || profileData.contactNo == null) ? '' : profileData.contactNo;

        if (!trimmedName) {
            setMessage({ title: "Validation", text: "Name cannot be empty", type: "error" });
            setIsMessageVisible(true);
            setIsLoading(false);
            return;
        }

        // Optimistically update local UI
        const updatedData = {
            ...profileData,
            name: trimmedName,
            contactNo: normalizedContact,
            lastUpdated: new Date().toISOString()
        };
        setProfileData(updatedData);

        try {
            // Persist to Firestore
            await updateUserInFirestore(appState.userDocId, {
                name: trimmedName,
                contactNo: normalizedContact,
                lastUpdated: updatedData.lastUpdated
            });

            // Notify parent/app-level state so it stays in sync
            if (typeof onProfileUpdated === 'function') {
                try { onProfileUpdated(updatedData); } catch (err) { console.warn('onProfileUpdated error', err); }
            }

            setMessage({ title: "Success", text: "Profile updated successfully", type: "success" });
            setIsEditing(false);
        } catch (error) {
            console.error('Profile update failed:', error);
            // revert on failure
            setProfileData(prevData);
            if (typeof onProfileUpdated === 'function') {
                try { onProfileUpdated(prevData); } catch (err) { console.warn('onProfileUpdated revert error', err); }
            }
            setMessage({ title: "Error", text: "Failed to update profile", type: "error" });
        } finally {
            setIsLoading(false);
            setIsMessageVisible(true);
        }
    };

    const closeMessage = () => setIsMessageVisible(false);

    return (
        <div className="p-8 bg-gray-100 min-h-screen">
            {isMessageVisible && (
                <MessageBox title={message.title} text={message.text} type={message.type} onClose={closeMessage} />
            )}
            <div className="max-w-3xl mx-auto w-full">
                <div className="flex items-center justify-between mb-6 border-b pb-4">
                    <button type="button" onClick={onBackToDashboard} className="text-indigo-600 hover:text-indigo-800 transition flex items-center">
                        <ArrowLeft className="w-5 h-5 mr-2" /> Back to Dashboard
                    </button>
                    <h1 className="text-3xl font-extrabold text-gray-800">User Profile</h1>
                </div>

                <div className="bg-white p-8 rounded-3xl shadow-2xl">
                    <div className="flex justify-between items-start mb-6">
                        <h2 className="text-2xl font-bold text-indigo-700">Personal Details</h2>

                        {isEditing ? (
                            <div className="flex space-x-3">
                                <PrimaryButton
                                    type="button"
                                    onClick={handleSave}
                                    className="w-auto bg-green-500 hover:bg-green-600"
                                    disabled={isLoading}
                                >
                                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                                </PrimaryButton>
                                <button 
                                    type="button"
                                    onClick={() => setIsEditing(false)} 
                                    className="w-auto px-4 py-3 font-semibold text-lg tracking-wider text-gray-700 bg-gray-200 rounded-xl hover:bg-gray-300 transition duration-300 disabled:bg-gray-400"
                                    disabled={isLoading}
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <PrimaryButton
                                type="button"
                                onClick={() => {
                                    console.log('Edit button clicked'); // Debug log
                                    setIsEditing(true);
                                }}
                                className="!px-4 !w-fit"
                            >
                                Edit Profile
                            </PrimaryButton>
                        )}
                    </div>
                    <form onSubmit={(e) => e.preventDefault()}>
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
                            type="button"
                            onClick={onPasswordChange}
                            className="w-full bg-red-500 hover:bg-red-600"
                            disabled={isEditing}
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

// import React, { useState, useEffect } from "react";
// import { User, Briefcase, Shield, Mail, Phone, ArrowLeft, Lock, Loader2 } from "lucide-react";

// // --- Import UI Components ---
// import PrimaryButton from '../components/PrimaryButton';
// import InputField from '../components/InputField';
// import MessageBox from '../components/MessageBox';

// import { auth, updateUserInFirestore } from '../api/firebase';

// const ProfileManagementPage = ({ appState, onBackToDashboard, onPasswordChange, onProfileUpdated }) => {
//     const [profileData, setProfileData] = useState({
//         name: appState.userData?.name || "Loading Name...",
//         email: appState.userData?.email || auth.currentUser?.email || "",
//         contactNo: appState.userData?.contactNo || "",
//         hostelId: appState.userDocId,
//         role: appState.userData?.role || appState.role,
//     });

//     const [isEditing, setIsEditing] = useState(false);
//     const [isMessageVisible, setIsMessageVisible] = useState(false);
//     const [message, setMessage] = useState({ title: "", text: "", type: "" });
//     const [isLoading, setIsLoading] = useState(false);

//     const primaryIdLabel = appState.role === 'student' ? 'Hostel ID' : 'User ID (Auth UID)';
//     const primaryIdValue = appState.role === 'student' ? profileData.hostelId : appState.userId;

//     useEffect(() => {
//         if (appState.userData) {
//             setProfileData(prev => ({
//                 ...prev,
//                 name: appState.userData.name || prev.name,
//                 email: appState.userData.email || prev.email,
//                 contactNo: appState.userData.contactNo || prev.contactNo,
//                 role: appState.userData.role || prev.role
//             }));
//         }
//     }, [appState.userData]);

//     const handleFieldChange = (e) => {
//         const { name, value } = e.target;
//         console.log('Field changed:', name, value); // Debug log
//         setProfileData(prev => ({ ...prev, [name]: value }));
//     };

//     const handleSave = async () => {
//         setIsLoading(true);

//         const prevData = profileData;
//         const trimmedName = (profileData.name || '').trim();
//         const normalizedContact = (profileData.contactNo === 'N/A' || profileData.contactNo == null) ? '' : profileData.contactNo;

//         if (!trimmedName) {
//             setMessage({ title: "Validation", text: "Name cannot be empty", type: "error" });
//             setIsMessageVisible(true);
//             setIsLoading(false);
//             return;
//         }

//         // Optimistically update local UI
//         const updatedData = {
//             ...profileData,
//             name: trimmedName,
//             contactNo: normalizedContact,
//             lastUpdated: new Date().toISOString()
//         };
//         setProfileData(updatedData);

//         try {
//             // Persist to Firestore
//             await updateUserInFirestore(appState.userDocId, {
//                 name: trimmedName,
//                 contactNo: normalizedContact,
//                 lastUpdated: updatedData.lastUpdated
//             });

//             // Notify parent/app-level state so it stays in sync
//             if (typeof onProfileUpdated === 'function') {
//                 try { onProfileUpdated(updatedData); } catch (err) { console.warn('onProfileUpdated error', err); }
//             }

//             setMessage({ title: "Success", text: "Profile updated successfully", type: "success" });
//             setIsEditing(false);
//         } catch (error) {
//             console.error('Profile update failed:', error);
//             // revert on failure
//             setProfileData(prevData);
//             if (typeof onProfileUpdated === 'function') {
//                 try { onProfileUpdated(prevData); } catch (err) { console.warn('onProfileUpdated revert error', err); }
//             }
//             setMessage({ title: "Error", text: "Failed to update profile", type: "error" });
//         } finally {
//             setIsLoading(false);
//             setIsMessageVisible(true);
//         }
//     };

//     const closeMessage = () => setIsMessageVisible(false);

//     return (
//         <div className="p-8 bg-gray-100 min-h-screen font-['Poppins']">
//             {isMessageVisible && (
//                 <MessageBox title={message.title} text={message.text} type={message.type} onClose={closeMessage} />
//             )}
//             <div className="max-w-3xl mx-auto w-full">
//                 <div className="flex items-center justify-between mb-6 border-b pb-4">
//                     <button onClick={onBackToDashboard} className="text-indigo-600 hover:text-indigo-800 transition flex items-center">
//                         <ArrowLeft className="w-5 h-5 mr-2" /> Back to Dashboard
//                     </button>
//                     <h1 className="text-3xl font-extrabold text-gray-800">User Profile</h1>
//                 </div>

//                 <div className="bg-white p-8 rounded-3xl shadow-2xl">
//                     <div className="flex justify-between items-start mb-6">
//                         <h2 className="text-2xl font-bold text-indigo-700">Personal Details</h2>

//                         {isEditing ? (
//                             <div className="flex space-x-3">
//                                 <PrimaryButton
//                                     onClick={handleSave}
//                                     className="w-auto px-6 py-2 text-sm bg-green-500 hover:bg-green-600"
//                                     disabled={isLoading}
//                                 >
//                                     {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
//                                 </PrimaryButton>
//                                 <button 
//                                     onClick={() => setIsEditing(false)} 
//                                     className="w-auto px-6 py-2 text-sm font-semibold text-gray-700 bg-gray-200 rounded-xl hover:bg-gray-300 transition duration-300 disabled:bg-gray-400"
//                                     disabled={isLoading}
//                                 >
//                                     Cancel
//                                 </button>
//                             </div>
//                         ) : (
//                             <PrimaryButton
//                                 onClick={() => {
//                                     console.log('Edit button clicked'); // Debug log
//                                     setIsEditing(true);
//                                 }}
//                                 className="inline-flex items-center justify-center min-w-[160px] px-6 py-3 text-base bg-indigo-500 hover:bg-indigo-600"
//                             >
//                                 Edit Profile
//                             </PrimaryButton>
//                         )}
//                     </div>
//                     <form>
//                         <InputField
//                             icon={User}
//                             type="text"
//                             placeholder="Full Name"
//                             name="name"
//                             value={profileData.name}
//                             onChange={handleFieldChange}
//                             readOnly={!isEditing}
//                         />

//                         <InputField
//                             icon={Briefcase}
//                             type="text"
//                             placeholder="Role"
//                             value={profileData.role ? profileData.role.charAt(0).toUpperCase() + profileData.role.slice(1) : appState.role.charAt(0).toUpperCase() + appState.role.slice(1)}
//                             readOnly={true}
//                         />

//                         <InputField
//                             icon={Shield}
//                             type="text"
//                             placeholder={primaryIdLabel}
//                             value={primaryIdValue}
//                             readOnly={true}
//                         />

//                         <InputField
//                             icon={Mail}
//                             type="email"
//                             placeholder="Email Address"
//                             value={profileData.email}
//                             readOnly={true}
//                         />

//                         <InputField
//                             icon={Phone}
//                             type="tel"
//                             placeholder="Contact Number (Optional)"
//                             name="contactNo"
//                             value={profileData.contactNo}
//                             onChange={handleFieldChange}
//                             readOnly={!isEditing}
//                             optional={true}
//                         />
//                     </form>

//                     <div className="mt-8 border-t pt-6">
//                         <h2 className="text-xl font-bold text-gray-800 mb-4">Security</h2>
//                         <PrimaryButton
//                             onClick={onPasswordChange}
//                             className="w-full bg-red-500 hover:bg-red-600"
//                             disabled={isEditing}
//                         >
//                             <div className="flex items-center justify-center">
//                                 <Lock className="w-5 h-5 mr-2" /> Change Password
//                             </div>
//                         </PrimaryButton>
//                     </div>
//                 </div>
//             </div>
//         </div>
//     );
// };

// export default ProfileManagementPage;
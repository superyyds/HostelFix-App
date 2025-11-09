// src/pages/RegisterUserPage.jsx

import React, { useState } from "react";
import { User, Shield, Mail, Compass, Plus, Loader2, ArrowLeft } from "lucide-react";

// --- Import UI Components ---
import PrimaryButton from '../components/PrimaryButton';
import InputField from '../components/InputField';
import MessageBox from '../components/MessageBox';
import RoleToggle from '../components/RoleToggle';

import {
    auth,
    createUserWithEmailAndPassword,
    signOut,
    signInWithEmailAndPassword,
    saveUserToFirestore,
    checkUserExists,
} from '../api/firebase';

import { wardenSessionCache } from '../api/cache';

const RegisterUserPage = ({ onBackToDashboard, onRegistrationStart, onRegistrationComplete }) => {
    const [name, setName] = useState("");
    const [hostelId, setHostelId] = useState("");
    const [email, setEmail] = useState("");
    const [contactNo, setContactNo] = useState("");
    const [role, setRole] = useState("student");
    const [tempPassword, setTempPassword] = useState("TempPass!1"); 
    const [isMessageVisible, setIsMessageVisible] = useState(false);
    const [message, setMessage] = useState({ title: "", text: "", type: "" });
    const [isLoading, setIsLoading] = useState(false);

    const handleRegisterUser = async (e) => {
        e.preventDefault();
        
        const wardenUser = auth.currentUser;
        if (!wardenUser) { 
            setMessage({ title: "Error", text: "Warden session expired. Please log in again.", type: "error" });
            setIsMessageVisible(true);
            return;
        }
        
        // CRITICAL CHECK: Ensure we have cached warden credentials for manual re-login
        if (!wardenSessionCache.email || !wardenSessionCache.password) {
             setMessage({ title: "Error", text: "Warden credentials not cached. Please log out and back in.", type: "error" });
             setIsMessageVisible(true);
             return;
        }

        if (!name || !hostelId || !email) {
            setMessage({ title: "Error", text: "Please fill in Name, Hostel ID, and Email.", type: "error" });
            setIsMessageVisible(true);
            return;
        }

        // 1. Start registration process - inform App Component
        setIsLoading(true);
        onRegistrationStart(); // This triggers the global loading screen

        try {
            // Check if user already exists in Firestore
            const hostelIdExists = await checkUserExists('hostelId', hostelId);
            const emailExists = await checkUserExists('email', email.toLowerCase());

            if (hostelIdExists) {
                throw new Error(`Hostel ID ${hostelId} is already registered.`);
            }
            if (emailExists) {
                throw new Error(`Email ${email} is already in use by another account.`);
            }

            // 2. Create user in Firebase Auth (Student signs in, hijacking the session)
            const newUserCredential = await createUserWithEmailAndPassword(auth, email, tempPassword);
            const newUser = newUserCredential.user;
            
            // 3. Prepare user data for Firestore
            const newUserData = {
                uid: newUser.uid,
                email: email.toLowerCase(),
                name: name,
                role: role,
                hostelId: hostelId,
                contactNo: contactNo || 'N/A',
                dateCreated: new Date().toISOString(),
                mustChangePassword: true, 
            };

            // 4. Save to Firestore
            await saveUserToFirestore(newUserData); 

            // 5. Kill Student Session
            await signOut(auth);
            
            // 6. Manually and instantly restore Warden's session
            await signInWithEmailAndPassword(auth, wardenSessionCache.email, wardenSessionCache.password);
            
            // --- SUCCESS: Clear form and inform App Component ---
            const registrationData = { 
                name, 
                hostelId, 
                tempPassword,
                email,
                role
            };
            
            // Clear form to allow new registration
            setName("");
            setHostelId("");
            setEmail("");
            setContactNo("");
            setRole("student");
            setTempPassword("TempPass!1");
            
            // Inform App Component the sequence is complete and successful
            onRegistrationComplete('success', registrationData);

        } catch (error) {
            console.error("Error registering user:", error);
            
            // Inform App Component the sequence failed
            onRegistrationComplete('error'); 

            let errorMessage = error.message;
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = "This email is already registered in Firebase Auth.";
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = "Invalid email address.";
            } else if (error.code === 'auth/weak-password') {
                errorMessage = "Temporary password is too weak. Please use a stronger password.";
            }

            setMessage({
                title: "Registration Failed",
                text: errorMessage,
                type: "error"
            });
            setIsMessageVisible(true);
        } finally {
            // Always stop local loading (App component handles global loading)
            setIsLoading(false);
        }
    };

    const closeMessage = () => setIsMessageVisible(false);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-5 relative">
            {/* Local error messages only - success handled at App level */}
            {isMessageVisible && (
                <MessageBox title={message.title} text={message.text} type={message.type} onClose={closeMessage} />
            )}

            <div className="w-full max-w-lg bg-white p-8 md:p-10 rounded-3xl shadow-2xl">
                <div className="flex items-center justify-center mb-2">
                    <Plus className="w-8 h-8 text-indigo-600 mr-3" />
                    <h1 className="text-3xl font-extrabold text-gray-800 tracking-tight">Register User</h1>
                </div>
                <div className="text-center text-gray-500 mb-6 text-lg font-light">
                    (Warden function to pre-populate student accounts)
                </div>

                <form onSubmit={handleRegisterUser}>
                    <RoleToggle role={role} setRole={setRole} disabled={isLoading} />

                    <InputField 
                        icon={User} 
                        type="text" 
                        placeholder="Full Name" 
                        value={name} 
                        onChange={(e) => setName(e.target.value)} 
                        disabled={isLoading}
                    />
                    <InputField 
                        icon={Shield} 
                        type="text" 
                        placeholder="Hostel ID (e.g., A-101)" 
                        value={hostelId} 
                        onChange={(e) => setHostelId(e.target.value.toUpperCase())} 
                        disabled={isLoading}
                    />
                    <InputField 
                        icon={Mail} 
                        type="email" 
                        placeholder="Email Address" 
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)} 
                        disabled={isLoading}
                    />
                    <InputField 
                        icon={Compass} 
                        type="tel" 
                        placeholder="Contact No (Optional)" 
                        value={contactNo} 
                        onChange={(e) => setContactNo(e.target.value)} 
                        optional={true} 
                        disabled={isLoading}
                    />

                    <div className="bg-yellow-50 border border-yellow-300 p-3 rounded-lg text-sm text-yellow-800 mb-6">
                        <p className="font-semibold">Temporary Password: {tempPassword}</p>
                        <p>User will be <strong>forced</strong> to change this upon first login.</p>
                    </div>

                    <PrimaryButton type="submit" disabled={isLoading}>
                        {isLoading ? (
                            <div className="flex items-center justify-center">
                                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                Creating Account...
                            </div>
                        ) : (
                            `Create ${role} Account`
                        )}
                    </PrimaryButton>
                </form>

                <div className="mt-6 text-center text-sm">
                    <button
                        onClick={onBackToDashboard}
                        className="text-indigo-600 hover:text-indigo-800 transition duration-150 flex items-center justify-center w-full focus:outline-none"
                        disabled={isLoading}
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RegisterUserPage;

// // src/pages/RegisterUserPage.jsx

// import React, { useState } from "react";
// import { User, Shield, Mail, Compass, Plus, Loader2, ArrowLeft } from "lucide-react";

// // --- Import UI Components ---
// import PrimaryButton from '../components/PrimaryButton';
// import InputField from '../components/InputField';
// import MessageBox from '../components/MessageBox';
// import RoleToggle from '../components/RoleToggle';

// import {
//     auth,
//     db,
//     createUserWithEmailAndPassword,
//     saveUserToFirestore,
//     checkUserExists
// } from '../api/firebase';

// const RegisterUserPage = ({ onBackToDashboard, onRegistrationComplete }) => {
//     const [name, setName] = useState("");
//     const [hostelId, setHostelId] = useState("");
//     const [email, setEmail] = useState("");
//     const [contactNo, setContactNo] = useState("");
//     const [role, setRole] = useState("student");
//     const [tempPassword, setTempPassword] = useState("TempPass!1"); 
//     const [isMessageVisible, setIsMessageVisible] = useState(false);
//     const [message, setMessage] = useState({ title: "", text: "", type: "" });
//     const [isLoading, setIsLoading] = useState(false);

//     const handleRegisterUser = async (e) => {
//         e.preventDefault();
//         setIsLoading(true); 

//         const wardenUser = auth.currentUser;
//         if (!wardenUser) { 
//             setMessage({ title: "Error", text: "Warden session expired. Please log in again.", type: "error" });
//             setIsMessageVisible(true);
//             setIsLoading(false);
//             return;
//         }

//         if (!name || !hostelId || !email) {
//             setMessage({ title: "Error", text: "Please fill in Name, Hostel ID, and Email.", type: "error" });
//             setIsMessageVisible(true);
//             setIsLoading(false);
//             return;
//         }

//         // --- Email Validation Block ---
//         const studentRegex = /^\S+@student\.usm\.my$/i;
//         const normalizedEmail = email.toLowerCase();
//         let validationError = null;

//         if (role === 'student') {
//             if (!studentRegex.test(normalizedEmail)) {
//                 validationError = "Invalid Student Email. Must be in the format 'xxx@student.usm.my'.";
//             }
//         } else if (role === 'warden') {
//             if (studentRegex.test(normalizedEmail)) {
//                 validationError = "Invalid Warden Email. Please use a '@usm.my' address, not a student email.";
//             } else if (!normalizedEmail.endsWith('@usm.my')) {
//                 validationError = "Invalid Warden Email. Must be in the format 'xxx@usm.my'.";
//             }
//         }

//         if (validationError) {
//             setMessage({ title: "Validation Error", text: validationError, type: "error" });
//             setIsMessageVisible(true);
//             setIsLoading(false);
//             return;
//         }

//         // Notify parent App that registration started
//         onRegistrationComplete(true); 

//         try {
//             console.log("🔄 DEBUG: Starting registration process...");
//             console.log("👮 DEBUG: Current warden UID:", wardenUser.uid);

//             // Step 1: Check if user already exists
//             console.log("🔍 DEBUG: Checking if user exists...");
//             const hostelIdExists = await checkUserExists('hostelId', hostelId);
//             const emailExists = await checkUserExists('email', normalizedEmail);

//             if (hostelIdExists) throw new Error(`Hostel ID ${hostelId} is already registered.`);
//             if (emailExists) throw new Error(`Email ${email} is already in use by another account.`);

//             // Step 2: Create student account directly without session switching
//             console.log("👤 DEBUG: Creating student account in background...");
//             const newUserCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, tempPassword);
//             const newUser = newUserCredential.user;
//             console.log("✅ DEBUG: Student account created:", newUser.uid);
            
//             // Step 3: Prepare and save student data to Firestore
//             console.log("💾 DEBUG: Saving student data to Firestore...");
//             const newUserData = {
//                 uid: newUser.uid,
//                 email: normalizedEmail,
//                 name: name,
//                 role: role,
//                 hostelId: hostelId,
//                 contactNo: contactNo || 'N/A',
//                 dateCreated: new Date().toISOString(),
//                 mustChangePassword: true, 
//                 createdBy: wardenUser.uid, // Track who created this account
//             };

//             await saveUserToFirestore(newUserData); 
//             console.log("✅ DEBUG: Student data saved to Firestore");

//             // Step 4: IMPORTANT - We don't sign out or switch sessions
//             // Firebase automatically maintains the warden session
//             console.log("✅ DEBUG: Warden session maintained automatically");

//             // --- SUCCESS: Registration completed successfully ---
//             console.log("🎉 DEBUG: Registration process completed successfully");
            
//             // Clear form fields
//             setName("");
//             setHostelId("");
//             setEmail("");
//             setContactNo("");
//             setRole("student");
//             setTempPassword("TempPass!1");
            
//             // Hide loading overlay
//             setIsLoading(false);
            
//             // Notify parent about successful completion
//             onRegistrationComplete(false, 'success', { 
//                 name, 
//                 hostelId, 
//                 tempPassword 
//             });

//             // Show success message box
//             setMessage({
//                 title: "Account Created Successfully! 🎉",
//                 text: `A new student account for ${name} (Hostel ID: ${hostelId}) has been created successfully. Temporary Password: ${tempPassword}. The student will be forced to change this password upon first login.`,
//                 type: "success"
//             });
//             setIsMessageVisible(true);

//             // Auto-hide success message after 5 seconds
//             setTimeout(() => {
//                 setIsMessageVisible(false);
//             }, 5000);

//         } catch (error) {
//             console.error("❌ DEBUG: Registration error:", error);
            
//             // Hide loading overlay on error
//             setIsLoading(false);
            
//             // Notify parent about error
//             onRegistrationComplete(false, 'error'); 

//             let errorMessage = error.message;
//             if (error.code === 'auth/email-already-in-use') {
//                 errorMessage = "This email is already registered in Firebase Auth.";
//             } else if (error.code === 'auth/invalid-email') {
//                 errorMessage = "Invalid email address.";
//             } else if (error.code === 'auth/network-request-failed') {
//                 errorMessage = "Network error. Please check your connection and try again.";
//             } else if (error.code === 'auth/operation-not-allowed') {
//                 errorMessage = "Email/password accounts are not enabled. Please contact administrator.";
//             }

//             setMessage({
//                 title: "Registration Failed",
//                 text: errorMessage,
//                 type: "error"
//             });
//             setIsMessageVisible(true);
//         }
//     };

//     const closeMessage = () => setIsMessageVisible(false);

//     return (
//         <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-5 relative">
//             {/* Loading Overlay */}
//             {isLoading && (
//                 <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-500 bg-opacity-30 backdrop-blur-sm">
//                     <div className="flex items-center p-6 bg-white rounded-lg shadow-xl">
//                         <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mr-3" />
//                         <div>
//                             <p className="text-xl text-indigo-700 font-semibold">Creating Account...</p>
//                             <p className="text-sm text-gray-600 mt-1">Setting up student account in background</p>
//                         </div>
//                     </div>
//                 </div>
//             )}
            
//             {/* Success/Error Message Box */}
//             {isMessageVisible && (
//                 <MessageBox 
//                     title={message.title} 
//                     text={message.text} 
//                     type={message.type} 
//                     onClose={closeMessage} 
//                 />
//             )}

//             {/* Registration Form - Stays Open After Success */}
//             <div className="w-full max-w-lg bg-white p-8 md:p-10 rounded-3xl shadow-2xl">
//                 <div className="flex items-center justify-center mb-2">
//                     <Plus className="w-8 h-8 text-indigo-600 mr-3" />
//                     <h1 className="text-3xl font-extrabold text-gray-800 tracking-tight">Register User</h1>
//                 </div>
//                 <p className="text-center text-gray-500 mb-6 text-lg font-light">
//                     (Warden function to pre-populate student accounts)
//                 </p>

//                 <form onSubmit={handleRegisterUser}>
//                     <RoleToggle role={role} setRole={setRole} disabled={isLoading} />
                    
//                     <InputField 
//                         icon={User} 
//                         type="text" 
//                         placeholder="Full Name" 
//                         value={name} 
//                         onChange={(e) => setName(e.target.value)} 
//                         disabled={isLoading}
//                         required
//                     />
                    
//                     <InputField 
//                         icon={Shield} 
//                         type="text" 
//                         placeholder="Hostel ID (e.g., A-101)" 
//                         value={hostelId} 
//                         onChange={(e) => setHostelId(e.target.value.toUpperCase())} 
//                         disabled={isLoading}
//                         required
//                     />
                    
//                     <InputField 
//                         icon={Mail} 
//                         type="email" 
//                         placeholder="Email Address" 
//                         value={email} 
//                         onChange={(e) => setEmail(e.target.value)} 
//                         disabled={isLoading}
//                         required
//                     />
                    
//                     <InputField 
//                         icon={Compass} 
//                         type="tel" 
//                         placeholder="Contact No (Optional)" 
//                         value={contactNo} 
//                         onChange={(e) => setContactNo(e.target.value)} 
//                         optional={true} 
//                         disabled={isLoading}
//                     />

//                     {/* Temporary Password Info */}
//                     <div className="bg-yellow-50 border border-yellow-300 p-3 rounded-lg text-sm text-yellow-800 mb-6">
//                         <p className="font-semibold">Temporary Password: {tempPassword}</p>
//                         <p>User will be <strong>forced</strong> to change this upon first login.</p>
//                     </div>

//                     {/* Submit Button */}
//                     <PrimaryButton type="submit" disabled={isLoading}>
//                         {isLoading ? (
//                             <div className="flex items-center justify-center">
//                                 <Loader2 className="w-5 h-5 animate-spin mr-2" />
//                                 Creating Account...
//                             </div>
//                         ) : (
//                             `Create ${role} Account`
//                         )}
//                     </PrimaryButton>
//                 </form>

//                 {/* Back to Dashboard Button */}
//                 <div className="mt-6 text-center text-sm">
//                     <button
//                         onClick={onBackToDashboard}
//                         className="text-indigo-600 hover:text-indigo-800 transition duration-150 flex items-center justify-center w-full focus:outline-none"
//                         disabled={isLoading}
//                     >
//                         <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
//                     </button>
//                 </div>
//             </div>
//         </div>
//     );
// };

// export default RegisterUserPage;

// // src/pages/RegisterUserPage.jsx

// import React, { useState } from "react";
// import { User, Shield, Mail, Compass, Plus, Loader2, ArrowLeft } from "lucide-react";

// // --- Import UI Components ---
// import PrimaryButton from '../components/PrimaryButton';
// import InputField from '../components/InputField';
// import MessageBox from '../components/MessageBox';
// import RoleToggle from '../components/RoleToggle';

// import {
//     auth,
//     createUserWithEmailAndPassword,
//     signOut,
//     signInWithEmailAndPassword,
//     saveUserToFirestore,
//     checkUserExists,
//     wardenSessionCache
// } from '../api/firebase';

// const RegisterUserPage = ({ onBackToDashboard, onRegistrationComplete }) => {
//     const [name, setName] = useState("");
//     const [hostelId, setHostelId] = useState("");
//     const [email, setEmail] = useState("");
//     const [contactNo, setContactNo] = useState("");
//     const [role, setRole] = useState("student");
//     const [tempPassword, setTempPassword] = useState("TempPass!1"); 
//     const [isMessageVisible, setIsMessageVisible] = useState(false);
//     const [message, setMessage] = useState({ title: "", text: "", type: "" });
//     const [isLoading, setIsLoading] = useState(false);

//     const handleRegisterUser = async (e) => {
//         e.preventDefault();
//         setIsLoading(true); 

//         const wardenUser = auth.currentUser;
//         if (!wardenUser) { 
//             setMessage({ title: "Error", text: "Warden session expired. Please log in again.", type: "error" });
//             setIsMessageVisible(true);
//             setIsLoading(false);
//             return;
//         }
        
//         if (!wardenSessionCache.email || !wardenSessionCache.password) {
//              setMessage({ title: "Error", text: "Warden credentials not cached. Please log out and back in.", type: "error" });
//              setIsMessageVisible(true);
//              setIsLoading(false);
//              return;
//         }

//         if (!name || !hostelId || !email) {
//             setMessage({ title: "Error", text: "Please fill in Name, Hostel ID, and Email.", type: "error" });
//             setIsMessageVisible(true);
//             setIsLoading(false);
//             return;
//         }

//         // --- ⬇️ Email Validation Block ⬇️ ---
//         const studentRegex = /^\S+@student\.usm\.my$/i;
//         const normalizedEmail = email.toLowerCase();
//         let validationError = null;

//         if (role === 'student') {
//             if (!studentRegex.test(normalizedEmail)) {
//                 validationError = "Invalid Student Email. Must be in the format 'xxx@student.usm.my'.";
//             }
//         } else if (role === 'warden') {
//             if (studentRegex.test(normalizedEmail)) {
//                 validationError = "Invalid Warden Email. Please use a '@usm.my' address, not a student email.";
//             } else if (!normalizedEmail.endsWith('@usm.my')) {
//                 validationError = "Invalid Warden Email. Must be in the format 'xxx@usm.my'.";
//             }
//         }

//         if (validationError) {
//             setMessage({ title: "Validation Error", text: validationError, type: "error" });
//             setIsMessageVisible(true);
//             setIsLoading(false);
//             return;
//         }
//         // --- ⬆️ End Validation Block ⬆️ ---

//         // Notify parent App that registration started
//         onRegistrationComplete(true); 

//         try {
//             // Check if user already exists
//             const hostelIdExists = await checkUserExists('hostelId', hostelId);
//             const emailExists = await checkUserExists('email', normalizedEmail);

//             if (hostelIdExists) throw new Error(`Hostel ID ${hostelId} is already registered.`);
//             if (emailExists) throw new Error(`Email ${email} is already in use by another account.`);

//             // Create user (temporarily logs in as new user)
//             const newUserCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, tempPassword);
//             const newUser = newUserCredential.user;
            
//             // Prepare Firestore data
//             const newUserData = {
//                 uid: newUser.uid,
//                 email: normalizedEmail,
//                 name: name,
//                 role: role,
//                 hostelId: hostelId,
//                 contactNo: contactNo || 'N/A',
//                 dateCreated: new Date().toISOString(),
//                 mustChangePassword: true, 
//             };

//             await saveUserToFirestore(newUserData); 

//             // Sign out student session
//             await signOut(auth);
            
//             // Restore warden session
//             await signInWithEmailAndPassword(auth, wardenSessionCache.email, wardenSessionCache.password);
            
//             // --- Success ---
//             setName("");
//             setHostelId("");
//             setEmail("");
//             setContactNo("");
//             setRole("student");
//             setTempPassword("TempPass!1");
//             setIsLoading(false);
            
//             // Inform parent that registration completed
//             onRegistrationComplete(false, 'success', { name, hostelId, tempPassword });

//             // ✅ Show success message and auto-hide after 4 seconds
//             setMessage({
//                 title: "Registration Successful",
//                 text: `New ${role} account for ${name} (${hostelId}) has been created successfully!`,
//                 type: "success"
//             });
//             setIsMessageVisible(true);
//             setTimeout(() => {
//                 setIsMessageVisible(false);
//             }, 4000);

//         } catch (error) {
//             console.error("Error registering user:", error);
//             onRegistrationComplete(false, 'error'); 

//             let errorMessage = error.message;
//             if (error.code === 'auth/email-already-in-use') {
//                 errorMessage = "This email is already registered in Firebase Auth.";
//             } else if (error.code === 'auth/invalid-email') {
//                 errorMessage = "Invalid email address.";
//             }

//             setMessage({
//                 title: "Registration Failed",
//                 text: errorMessage,
//                 type: "error"
//             });
//             setIsLoading(false);
//             setIsMessageVisible(true);
//         }
//     };

//     const closeMessage = () => setIsMessageVisible(false);

//     return (
//         <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-5 relative">
//             {isLoading && (
//                 <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-500 bg-opacity-30 backdrop-blur-sm">
//                     <div className="flex items-center p-4 bg-white rounded-lg shadow-xl">
//                         <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mr-3" />
//                         <p className="text-xl text-indigo-700 font-semibold">Creating account and restoring session...</p>
//                     </div>
//                 </div>
//             )}
            
//             {isMessageVisible && (
//                 <MessageBox title={message.title} text={message.text} type={message.type} onClose={closeMessage} />
//             )}

//             <div className="w-full max-w-lg bg-white p-8 md:p-10 rounded-3xl shadow-2xl">
//                 <div className="flex items-center justify-center mb-2">
//                     <Plus className="w-8 h-8 text-indigo-600 mr-3" />
//                     <h1 className="text-3xl font-extrabold text-gray-800 tracking-tight">Register User</h1>
//                 </div>
//                 <p className="text-center text-gray-500 mb-6 text-lg font-light">
//                     (Warden function to pre-populate student accounts)
//                 </p>

//                 <form onSubmit={handleRegisterUser}>
//                     <RoleToggle role={role} setRole={setRole} disabled={isLoading} />
//                     <InputField icon={User} type="text" placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} />
//                     <InputField icon={Shield} type="text" placeholder="Hostel ID (e.g., A-101)" value={hostelId} onChange={(e) => setHostelId(e.target.value.toUpperCase())} />
//                     <InputField icon={Mail} type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} />
//                     <InputField icon={Compass} type="tel" placeholder="Contact No (Optional)" value={contactNo} onChange={(e) => setContactNo(e.target.value)} optional={true} />

//                     <div className="bg-yellow-50 border border-yellow-300 p-3 rounded-lg text-sm text-yellow-800 mb-6">
//                         <p className="font-semibold">Temporary Password: {tempPassword}</p>
//                         <p>User will be **forced** to change this upon first login.</p>
//                     </div>

//                     <PrimaryButton type="submit" disabled={isLoading}>
//                         {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : `Create ${role} Account`}
//                     </PrimaryButton>
//                 </form>

//                 <div className="mt-6 text-center text-sm">
//                     <button
//                         onClick={onBackToDashboard}
//                         className="text-indigo-600 hover:text-indigo-800 transition duration-150 flex items-center justify-center w-full focus:outline-none"
//                         disabled={isLoading}
//                     >
//                         <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
//                     </button>
//                 </div>
//             </div>
//         </div>
//     );
// };

// export default RegisterUserPage;

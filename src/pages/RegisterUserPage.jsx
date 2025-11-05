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
    wardenSessionCache
} from '../api/firebase';

const RegisterUserPage = ({ onBackToDashboard, onRegistrationComplete }) => {
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
        setIsLoading(true); 

        const wardenUser = auth.currentUser;
        if (!wardenUser) { 
            setMessage({ title: "Error", text: "Warden session expired. Please log in again.", type: "error" });
            setIsMessageVisible(true);
            setIsLoading(false);
            return;
        }
        
        if (!wardenSessionCache.email || !wardenSessionCache.password) {
             setMessage({ title: "Error", text: "Warden credentials not cached. Please log out and back in.", type: "error" });
             setIsMessageVisible(true);
             setIsLoading(false);
             return;
        }

        if (!name || !hostelId || !email) {
            setMessage({ title: "Error", text: "Please fill in Name, Hostel ID, and Email.", type: "error" });
            setIsMessageVisible(true);
            setIsLoading(false);
            return;
        }

        // 0. Inform App Component that an unstable sequence is starting
        onRegistrationComplete(true); 

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

            // 1. Create user in Firebase Auth (Student signs in, hijacking the session)
            const newUserCredential = await createUserWithEmailAndPassword(auth, email, tempPassword);
            const newUser = newUserCredential.user;
            
            // 2. Prepare user data for Firestore
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

            // 3. Save to Firestore
            await saveUserToFirestore(newUserData); 

            // 4. Kill Student Session
            await signOut(auth);
            
            // 5. Manually and instantly restore Warden's session
            await signInWithEmailAndPassword(auth, wardenSessionCache.email, wardenSessionCache.password);
            
            // --- Success: End Loading and Clear Form ---
            setName("");
            setHostelId("");
            setEmail("");
            setContactNo("");
            setRole("student");
            setTempPassword("TempPass!1");
            
            setIsLoading(false);
            
            // Inform App Component the sequence is complete and stable WITH DATA
            onRegistrationComplete(false, 'success', { name, hostelId, tempPassword });

        } catch (error) {
            console.error("Error registering user:", error);
            
            // Inform App Component the sequence is complete but failed
            onRegistrationComplete(false, 'error'); 

            let errorMessage = error.message;
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = "This email is already registered in Firebase Auth.";
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = "Invalid email address.";
            }

            setMessage({
                title: "Registration Failed",
                text: errorMessage,
                type: "error"
            });
            setIsLoading(false);
            setIsMessageVisible(true);
        }
    };

    const closeMessage = () => setIsMessageVisible(false);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-5 relative">
            {isLoading && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-500 bg-opacity-30 backdrop-blur-sm">
                    <div className="flex items-center p-4 bg-white rounded-lg shadow-xl">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mr-3" />
                        <p className="text-xl text-indigo-700 font-semibold">Creating account and restoring session...</p>
                    </div>
                </div>
            )}
            
            {isMessageVisible && (
                <MessageBox title={message.title} text={message.text} type={message.type} onClose={closeMessage} />
            )}

            <div className="w-full max-w-lg bg-white p-8 md:p-10 rounded-3xl shadow-2xl">
                <div className="flex items-center justify-center mb-2">
                    <Plus className="w-8 h-8 text-indigo-600 mr-3" />
                    <h1 className="text-3xl font-extrabold text-gray-800 tracking-tight">Register User</h1>
                </div>
                <p className="text-center text-gray-500 mb-6 text-lg font-light">
                    (Warden function to pre-populate student accounts)
                </p>

                <form onSubmit={handleRegisterUser}>
                    <RoleToggle role={role} setRole={setRole} disabled={isLoading} />

                    <InputField icon={User} type="text" placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} />
                    <InputField icon={Shield} type="text" placeholder="Hostel ID (e.g., A-101)" value={hostelId} onChange={(e) => setHostelId(e.target.value.toUpperCase())} />
                    <InputField icon={Mail} type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} />
                    <InputField icon={Compass} type="tel" placeholder="Contact No (Optional)" value={contactNo} onChange={(e) => setContactNo(e.target.value)} optional={true} />

                    <div className="bg-yellow-50 border border-yellow-300 p-3 rounded-lg text-sm text-yellow-800 mb-6">
                        <p className="font-semibold">Temporary Password: {tempPassword}</p>
                        <p>User will be **forced** to change this upon first login.</p>
                    </div>

                    <PrimaryButton type="submit" disabled={isLoading}>
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : `Create ${role} Account`}
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
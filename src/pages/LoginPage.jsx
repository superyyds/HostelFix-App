// src/pages/LoginPage.jsx

import React, { useState, useEffect } from "react";
import { LogIn, Briefcase, Mail, Shield, User, Phone, Loader2 } from "lucide-react";

// --- Import UI Components ---
import PrimaryButton from '../components/PrimaryButton';
import InputField from '../components/InputField';
import MessageBox from '../components/MessageBox';
import RoleToggle from '../components/RoleToggle';

// Import necessary API helpers
import { 
    auth, 
    signInWithEmailAndPassword, 
    fetchUserRole, 
    wardenSessionCache 
} from '../api/firebase';

const LoginPage = ({ onLoginSuccess, onForgotPassword }) => {
    const [credential, setCredential] = useState("");
    const [hostelId, setHostelId] = useState("");
    const [password, setPassword] = useState("");
    const [roleType, setRoleType] = useState("student");
    const [isMessageVisible, setIsMessageVisible] = useState(false);
    const [message, setMessage] = useState({ title: "", text: "", type: "" });
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        setCredential("");
        setHostelId("");
        setPassword("");
        setIsMessageVisible(false);
    }, [roleType]);

    const placeholder = roleType === 'student' ? "Student Email" : "Warden Email";

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        if (!credential || !password || (roleType === 'student' && !hostelId)) {
            setMessage({ title: "Login Failed", text: `Please fill in all required fields.`, type: "error" });
            setIsMessageVisible(true);
            setIsLoading(false);
            return;
        }

        // Cache the credentials immediately for potential Warden re-login/restoration
        if (roleType === 'warden') {
            wardenSessionCache.email = credential;
            wardenSessionCache.password = password;
        }

        try {
            // Firebase Email/Password Authentication
            const userCredential = await signInWithEmailAndPassword(auth, credential, password);
            const user = userCredential.user;

            // Fetch user data from Firestore
            const userData = await fetchUserRole(user.uid, credential);

            setMessage({
                title: "Login Successful",
                text: `Welcome! Authenticating as ${credential}...`,
                type: "success",
            });
            setIsMessageVisible(true);

            setTimeout(() => {
                setIsMessageVisible(false);
                onLoginSuccess({
                    role: userData.role,
                    userDocId: userData.userDocId,
                    mustChange: userData.mustChangePassword,
                    userData: userData.userData
                });
                setIsLoading(false);
            }, 1000);

        } catch (error) {
            console.error("Login error:", error);
            let errorMessage = "Login failed. Please check your credentials.";

            if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
                errorMessage = "Invalid email or password.";
            } else if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-email') {
                errorMessage = "No account found with this email.";
            }

            setMessage({ title: "Login Failed", text: errorMessage, type: "error" });
            setIsMessageVisible(true);
            setIsLoading(false);
        }
    };

    const closeMessage = () => setIsMessageVisible(false);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4 font-['Poppins']">
            {isMessageVisible && (
                <MessageBox
                    title={message.title}
                    text={message.text}
                    type={message.type}
                    onClose={closeMessage}
                />
            )}

            <div className="w-full max-w-md bg-white p-8 md:p-10 rounded-3xl shadow-2xl transition duration-500 transform hover:shadow-xl hover:scale-[1.01]">
                <div className="flex items-center justify-center mb-2">
                    <Briefcase className="w-10 h-10 text-indigo-600 mr-3" />
                    <h1 className="text-4xl font-extrabold text-gray-800 tracking-tight">HostelFix</h1>
                </div>
                <p className="text-center text-gray-500 mb-8 text-lg font-light">
                    Sign in to manage facility issues.
                </p>

                <RoleToggle role={roleType} setRole={setRoleType} disabled={isLoading} />

                <form onSubmit={handleLogin}>
                    {roleType === 'student' && (
                        <InputField
                            icon={Shield}
                            type="text"
                            placeholder="Hostel ID (e.g., A-101)"
                            value={hostelId}
                            onChange={(e) => setHostelId(e.target.value.toUpperCase())}
                        />
                    )}

                    <InputField
                        icon={Mail}
                        type="email"
                        placeholder={placeholder}
                        value={credential}
                        onChange={(e) => setCredential(e.target.value)}
                    />

                    <InputField
                        icon={LogIn}
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />

                    <div className="mt-8">
                        <PrimaryButton type="submit" disabled={isLoading}>
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Sign In'}
                        </PrimaryButton>
                    </div>
                </form>

                <div className="mt-6 text-center text-sm">
                    <button
                        onClick={onForgotPassword}
                        className="text-indigo-600 hover:text-indigo-800 transition duration-150 focus:outline-none"
                        disabled={isLoading}
                    >
                        Forgot Password?
                    </button>
                </div>

                <div className="mt-8 border-t pt-6 text-center">
                    <p className="text-sm text-gray-500 mb-3">Any inquiries?</p>
                    <div className="space-y-2">
                        <a
                            href="tel:+60123456789"
                            className="flex items-center justify-center text-md font-semibold text-gray-700 hover:text-indigo-600 transition duration-150"
                        >
                            <User className="w-4 h-4 mr-2" /> Admin Office: +60 12-345 6789
                        </a>
                        <a
                            href="tel:+60119876543"
                            className="flex items-center justify-center text-md font-semibold text-gray-700 hover:text-indigo-600 transition duration-150"
                        >
                            <Phone className="w-4 h-4 mr-2" /> Technical Support: +60 11-987 6543
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
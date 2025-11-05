// src/pages/PasswordRecoveryPage.jsx

import React, { useState } from "react";
import { Key, Mail, Loader2, ArrowLeft } from "lucide-react";

// --- Import UI Components ---
import PrimaryButton from '../components/PrimaryButton';
import InputField from '../components/InputField';
import MessageBox from '../components/MessageBox';

import { auth, sendPasswordResetEmail } from '../api/firebase';

const PasswordRecoveryPage = ({ onBackToLogin }) => {
    const [email, setEmail] = useState("");
    const [isMessageVisible, setIsMessageVisible] = useState(false);
    const [message, setMessage] = useState({ title: "", text: "", type: "" });
    const [isLoading, setIsLoading] = useState(false);

    const handleRecovery = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        if (!email) {
            setMessage({ title: "Error", text: "Please enter your email address.", type: "error" });
            setIsMessageVisible(true);
            setIsLoading(false);
            return;
        }

        try {
            await sendPasswordResetEmail(auth, email);

            setMessage({
                title: "Check Your Email",
                text: "If an account exists for this email, a password reset link has been sent.",
                type: "success"
            });
            setIsMessageVisible(true);
            setEmail("");
        } catch (error) {
            console.error("Password reset error:", error);
            setMessage({
                title: "Error",
                text: "Failed to send reset email. Please check the email address.",
                type: "error"
            });
            setIsMessageVisible(true);
        }
        setIsLoading(false);
    };

    const closeMessage = () => setIsMessageVisible(false);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
            {isMessageVisible && (
                <MessageBox title={message.title} text={message.text} type={message.type} onClose={closeMessage} />
            )}

            <div className="w-full max-w-md bg-white p-8 md:p-10 rounded-xl shadow-2xl">
                <div className="flex items-center justify-center mb-2">
                    <Key className="w-8 h-8 text-indigo-600 mr-3" />
                    <h1 className="text-3xl font-extrabold text-gray-800 tracking-tight">Forgot Password</h1>
                </div>
                <p className="text-center text-gray-500 mb-8 text-lg font-light">
                    Enter your email to receive a reset link.
                </p>

                <form onSubmit={handleRecovery}>
                    <InputField icon={Mail} type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} />

                    <div className="mt-8">
                        <PrimaryButton type="submit" disabled={isLoading}>
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Send Reset Link'}
                        </PrimaryButton>
                    </div>
                </form>

                <div className="mt-6 text-center text-sm">
                    <button
                        onClick={onBackToLogin}
                        className="text-indigo-600 hover:text-indigo-800 transition duration-150 flex items-center justify-center w-full focus:outline-none"
                        disabled={isLoading}
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Sign In
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PasswordRecoveryPage;
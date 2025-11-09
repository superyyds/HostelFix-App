// src/pages/ChangePasswordPage.jsx

import React, { useState } from "react";
import { Lock, Key, Loader2 } from "lucide-react";

// --- Import UI Components ---
import PrimaryButton from '../components/PrimaryButton';
import InputField from '../components/InputField';
import MessageBox from '../components/MessageBox';

import { auth, signInWithEmailAndPassword, updatePassword, updateUserInFirestore } from '../api/firebase';

const ChangePasswordPage = ({ 
    onPasswordChangeComplete,  // ✅ renamed from onForcedPasswordChangeComplete
    userId, 
    userDocId, 
    userRole, 
    isVoluntary = false, 
    onCancel 
}) => {
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isMessageVisible, setIsMessageVisible] = useState(false);
    const [message, setMessage] = useState({ title: "", text: "", type: "" });
    const [isLoading, setIsLoading] = useState(false);

    const alphanumericSymbol = /^(?=.*[a-zA-Z])(?=.*[0-9])(?=.*[^a-zA-Z0-9\s]).{8,}$/;

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        if (!newPassword || !confirmPassword || (isVoluntary && !oldPassword)) {
            setMessage({ title: "Error", text: "Please fill in all required password fields.", type: "error" });
            setIsMessageVisible(true);
            setIsLoading(false);
            return;
        }
        if (newPassword !== confirmPassword) {
            setMessage({ title: "Error", text: "New password and confirmation do not match.", type: "error" });
            setIsMessageVisible(true);
            setIsLoading(false);
            return;
        }
        if (!alphanumericSymbol.test(newPassword)) {
            setMessage({ title: "Error", text: "Password must be at least 8 characters long and contain letters, numbers, and symbols.", type: "error" });
            setIsMessageVisible(true);
            setIsLoading(false);
            return;
        }
        if (isVoluntary && oldPassword === newPassword) {
            setMessage({ title: "Error", text: "New password must be different from the current password.", type: "error" });
            setIsMessageVisible(true);
            setIsLoading(false);
            return;
        }

        try {
            const user = auth.currentUser;
            if (!user || !user.email) {
                throw new Error("User not authenticated or email missing.");
            }

            // Re-authenticate (only needed for voluntary change)
            if (isVoluntary) {
                await signInWithEmailAndPassword(auth, user.email, oldPassword);
            }

            // Update password in Firebase Authentication
            await updatePassword(user, newPassword);

            // Update flag in Firestore
            await updateUserInFirestore(userDocId, {
                mustChangePassword: false,
                passwordLastChanged: new Date().toISOString(),
            });

            setMessage({
                title: "Success! 🔑",
                text: "Your password has been securely updated.",
                type: "success",
            });
            setIsMessageVisible(true);

            // Redirect user after success
            setTimeout(() => {
                if (onPasswordChangeComplete) onPasswordChangeComplete(); // ✅ unified callback
            }, 1500);

        } catch (error) {
            console.error("Password update error:", error);
            let errorMessage = "Could not update password. Please try logging in again.";

            if (error.code === "auth/wrong-password") {
                errorMessage = "Current password is incorrect.";
            } else if (error.code === "auth/requires-recent-login") {
                errorMessage = "Please log in again to change your password.";
            } else if (error.code === "auth/weak-password") {
                errorMessage = "New password is too weak. Please choose a stronger password.";
            }

            setMessage({ title: "Update Failed", text: errorMessage, type: "error" });
            setIsMessageVisible(true);
        }

        setIsLoading(false);
    };

    const closeMessage = () => setIsMessageVisible(false);

    const isFormValid = () => {
        const newPassValid = newPassword && alphanumericSymbol.test(newPassword);
        const matchValid = newPassword === confirmPassword;

        if (isVoluntary) {
            return oldPassword && newPassValid && matchValid && oldPassword !== newPassword;
        } else {
            return newPassValid && matchValid;
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-indigo-50 p-4">
            {isMessageVisible && (
                <MessageBox title={message.title} text={message.text} type={message.type} onClose={closeMessage} />
            )}

            <div className="w-full max-w-xl bg-white p-8 md:p-10 rounded-3xl shadow-2xl">
                <div className="flex items-center justify-center mb-2">
                    <Lock className="w-8 h-8 text-red-600 mr-3" />
                    <h1 className="text-3xl font-extrabold text-gray-800 tracking-tight">
                        {isVoluntary ? "Change Password" : "Mandatory Password Change"}
                    </h1>
                </div>

                <p className="text-center text-red-600 mb-6 text-lg font-bold border-b pb-4">
                    {isVoluntary
                        ? "Update your password securely."
                        : "You must change your temporary password immediately."}
                </p>

                <p className="text-center text-gray-600 mb-8 text-sm">
                    Logged in as <strong>{userRole}</strong> ({userDocId || userId})
                </p>

                <form onSubmit={handleChangePassword}>
                    {isVoluntary && (
                        <InputField
                            icon={Key}
                            type="password"
                            placeholder="Current Password"
                            value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                        />
                    )}

                    <InputField
                        icon={Key}
                        type="password"
                        placeholder="New Password (min 8 chars, num + letter + symbol)"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                    />

                    <InputField
                        icon={Key}
                        type="password"
                        placeholder="Confirm New Password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                    />

                    {newPassword && !alphanumericSymbol.test(newPassword) && (
                        <div className="mb-4 p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-700 text-sm">
                            **Security Requirement:** Password must be 8+ characters and contain a letter, a number, and a symbol.
                        </div>
                    )}

                    {newPassword && confirmPassword && newPassword !== confirmPassword && (
                        <div className="mb-4 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                            New password and confirmation do not match.
                        </div>
                    )}

                    {isVoluntary && oldPassword && newPassword && oldPassword === newPassword && (
                        <div className="mb-4 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                            New password must be different from current password.
                        </div>
                    )}

                    <PrimaryButton type="submit" disabled={isLoading || !isFormValid()}>
                        {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                        ) : (
                            "Set New Password"
                        )}
                    </PrimaryButton>
                </form>

                {isVoluntary && (
                    <button
                        onClick={onCancel}
                        className="w-full mt-4 py-3 px-4 font-semibold text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition duration-300 disabled:bg-gray-400"
                        disabled={isLoading}
                    >
                        Cancel
                    </button>
                )}
            </div>
        </div>
    );
};

export default ChangePasswordPage;



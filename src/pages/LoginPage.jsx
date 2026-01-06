import React, { useState, useEffect } from "react";
import { LogIn, Briefcase, Mail, Shield, User, Phone, Loader2 } from "lucide-react";
import PrimaryButton from '../components/PrimaryButton';
import InputField from '../components/InputField';
import MessageBox from '../components/MessageBox';
import RoleToggle from '../components/RoleToggle';
import { 
    auth, 
    signInWithEmailAndPassword,
    signOut,
    fetchUserRole
} from '../api/firebase';
import { createBackendSession } from '../api/backendSession';
import { wardenSessionCache } from '../api/cache';
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from '../api/firebase';

const LoginPage = ({ onForgotPassword, onLoginFailure, onValidationFailure, onLoginSuccess, onMandatoryPasswordChange }) => { 
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
    }, [roleType]);

    const showMessage = (title, text, type, autoClose = true, duration = 5000) => {
        setMessage({ title, text, type });
        setIsMessageVisible(true);
        
        if (autoClose) {
            setTimeout(() => {
                setIsMessageVisible(false);
            }, duration);
        }
    };

    const closeMessage = () => setIsMessageVisible(false);

    const placeholder = roleType === 'student' ? "Student Email" : 
                        roleType === 'warden' ? "Warden Email" :
                        "Staff Email";

    // 🔑 CRITICAL FIX: Enhanced role validation BEFORE Firebase auth
    const validateRoleBeforeAuth = async (email, selectedRole) => {
        try {
            console.log("🔍 DEBUG: Pre-auth role validation for:", email);
            
            // Try to fetch user data by email only (without authentication)
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('email', '==', email.toLowerCase()));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                return { isValid: false, error: "Account not found. Please check your email." };
            }
            
            const userDoc = querySnapshot.docs[0];
            const userData = userDoc.data();
            
            if (!userData.role) {
                return { isValid: false, error: "Account data incomplete. Please contact admin." };
            }
            
            const actualRole = userData.role;
            
            if (selectedRole !== actualRole) {
                let errorMessage = "";
                if (actualRole === 'student' && (selectedRole === 'staff' || selectedRole === 'warden')) {
                    errorMessage = "This is a student account. Please select 'Student' role to login.";
                } else if (actualRole === 'staff' && selectedRole === 'warden') {
                    errorMessage = "This is a staff account. Please select 'Staff' role to login.";
                } else if (actualRole === 'warden' && selectedRole === 'staff') {
                    errorMessage = "This is a warden account. Please select 'Warden' role to login."; 
                } else {
                    errorMessage = `Role mismatch. Your account is registered as ${actualRole}, but you selected ${selectedRole}. Please select the correct role.`;
                }
                
                return { isValid: false, error: errorMessage };
            }
            
            return { isValid: true, userData };
            
        } catch (error) {
            // If pre-auth validation fails, we'll fall back to post-auth validation
            return { isValid: true }; // Allow login attempt to proceed
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setIsMessageVisible(false); 

        console.log("🔍 DEBUG: Login started - Role:", roleType, "Email:", credential);

        // 1. Client-Side Required Field Check
        if (!credential || !password || (roleType === 'student' && !hostelId)) {
            setIsLoading(false);
            showMessage("Login Failed", "Please fill in all required fields.", "error");
            return;
        }

        // 2. Email Format Validation
        const studentRegex = /^\S+@student\.usm\.my$/i;
        const normalizedEmail = credential.toLowerCase();
        let validationError = null;

        if (roleType === 'student') {
            if (!studentRegex.test(normalizedEmail)) {
                validationError = "Invalid Student Email. Must be in the format 'xxx@student.usm.my'.";
            }
        } else if (roleType === 'staff' || roleType === 'warden') {
            const roleName = roleType.charAt(0).toUpperCase() + roleType.slice(1);
            if (studentRegex.test(normalizedEmail)) {
                validationError = `${roleName} registration cannot use a student email address.`;
            } else if (!normalizedEmail.endsWith('@usm.my')) {
                validationError = `${roleName} accounts must use the official 'xxx@usm.my' format.`;
            }
        }

        if (validationError) {
            setIsLoading(false);
            showMessage("Validation Error", validationError, "error");
            return;
        }

        // 🔑 CRITICAL FIX: Pre-auth role validation attempt
        console.log("🟡 DEBUG: Attempting pre-auth role validation...");
        const preAuthValidation = await validateRoleBeforeAuth(normalizedEmail, roleType);
        
        if (!preAuthValidation.isValid) {
            setIsLoading(false);
            showMessage("Role Mismatch", preAuthValidation.error, "error");
            return; // STOP HERE - don't even attempt Firebase auth
        }

        // 3. Cache warden/staff credentials
        if (roleType === 'warden' || roleType === 'staff') {
            wardenSessionCache.email = normalizedEmail;
            wardenSessionCache.password = password;
            console.log("🔍 DEBUG: Credentials cached for:", roleType);
        }

        // 🔑 CRITICAL FIX: Set login failure lock BEFORE any Firebase auth
        console.log("🔒 DEBUG: Setting login failure lock BEFORE Firebase auth");
        onLoginFailure(true);

        try {
            console.log("🟢 DEBUG: Starting Firebase authentication...");
            
            // 4. Firebase Authentication
            const userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
            const user = userCredential.user;
            console.log("🟢 DEBUG: Firebase authentication successful - User ID:", user.uid);
            
            // 🔑 DOUBLE VALIDATION: Post-auth role verification (backup)
            console.log("🟢 DEBUG: Verifying role post-authentication...");
            const firestoreData = await fetchUserRole(user.uid, user.email);
            
            if (!firestoreData || !firestoreData.role) {
                await signOut(auth);
                showMessage("Login Failed", "Your account data is incomplete. Please contact admin.", "error"); 
                setIsLoading(false);
                return;
            }
            
            const actualUserRole = firestoreData.role;
            console.log("🟢 DEBUG: Post-auth actual user role:", actualUserRole);

            // Final role mismatch check (should rarely trigger due to pre-auth check)
            if (roleType !== actualUserRole) {
                
                let errorMessage = "";
                if (actualUserRole === 'student' && (roleType === 'staff' || roleType === 'warden')) {
                    errorMessage = "This is a student account. Please select 'Student' role to login.";
                } else if (actualUserRole === 'staff' && roleType === 'warden') {
                    errorMessage = "This is a staff account. Please select 'Staff' role to login.";
                } else if (actualUserRole === 'warden' && roleType === 'staff') {
                    errorMessage = "This is a warden account. Please select 'Warden' role to login."; 
                } else {
                    errorMessage = `Role mismatch. Your account is registered as ${actualUserRole}, but you selected ${roleType}. Please select the correct role.`;
                }

                await signOut(auth);
                showMessage("Role Mismatch", errorMessage, "error");
                setIsLoading(false);
                return;
            }

            // ✅ HOSTEL ID SECURITY CHECK (Only for Students)
            if (actualUserRole === 'student') {
                if (!firestoreData.userData || !firestoreData.userData.hostelId) {
                    await signOut(auth);
                    showMessage("Login Failed", "Your account data is incomplete (missing Hostel ID). Please contact admin.", "error");
                    setIsLoading(false);
                    return;
                }

                const typedHostelId = hostelId.trim().toUpperCase();
                const dbHostelId = firestoreData.userData.hostelId.trim().toUpperCase();

                if (typedHostelId !== dbHostelId) {
                    await signOut(auth);
                        showMessage("Login Failed", "The Hostel ID you entered does not match the email on record.", "error");
                    setIsLoading(false);
                    return;
                }
            }

            // 🔥 CRITICAL FIX: Check for mandatory password change WITHOUT signing out
            if (firestoreData.mustChangePassword === true) {
                console.log("🟡 DEBUG: Mandatory password change required for user");
                
                // ✅ DON'T sign out - keep user authenticated
                // ✅ Use correct property name
                onMandatoryPasswordChange({
                    userId: user.uid,
                    userDocId: firestoreData.userDocId, // ✅ Fixed property
                    userRole: actualUserRole
                });
                
                setIsLoading(false);
                return;
            }

            // --- ✅ ALL SECURITY CHECKS PASSED ---
            console.log("🎉 DEBUG: All checks passed - login successful. Creating backend session...");

            // Create secure backend session (Express + cookies) after Firebase auth succeeds
            try {
                await createBackendSession(user.email, actualUserRole);
            } catch (backendError) {
                console.error("❌ Backend session creation failed:", backendError);
                // If backend session fails, sign out to keep state consistent
                await signOut(auth);
                onLoginFailure(false);
                setIsLoading(false);
                showMessage(
                    "Login Failed",
                    "We could not create a secure server session. Please try again shortly.",
                    "error"
                );
                return;
            }
            
            // Release the lock and signal success
            onLoginSuccess();
            onLoginFailure(false);
            
            setIsLoading(false);
            showMessage("Login Successful", "Verification complete. Routing to dashboard...", "success", false);
            
        } catch (error) {
            
            // Release the lock on auth failure
            onLoginFailure(false);
            
            let errorMessage = "Login failed. Please check your credentials.";

            if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-email') {
                errorMessage = "Invalid email or password.";
            } else if (error.code === 'auth/network-request-failed') {
                errorMessage = "Network error. Please check your internet connection.";
            } else {
                 errorMessage = "An unexpected error occurred during login. Please try again.";
            }
            
            setIsLoading(false);
            showMessage("Login Failed", errorMessage, "error");
        }
    };

    return (
        <div 
            className="relative flex flex-col items-center justify-center min-h-screen bg-gray-50 bg-cover bg-center p-4"
            style={{ 
                backgroundImage: "url('/login-bg.jpg')" 
            }} 
        >
            <div className="absolute inset-0 bg-black opacity-50 z-0"></div>

            {/* Message Container - For local errors like "Missing fields" */}
            {isMessageVisible && (
                <div className="fixed top-4 right-4 z-50 max-w-sm w-full p-2">
                <MessageBox
                    title={message.title}
                    text={message.text}
                    type={message.type}
                    onClose={closeMessage}
                    className="pointer-events-auto" 
                />
                </div>
            )}
            
            <div className="w-full max-w-md bg-white p-8 md:p-10 rounded-3xl shadow-2xl transition duration-500 transform hover:shadow-xl hover:scale-[1.01] z-10">
                <div className="flex items-center justify-center mb-2">
                    {/* <Briefcase className="w-10 h-10 text-indigo-600 mr-3" />
                    <h1 className="text-4xl font-extrabold text-gray-800 tracking-tight">HostelFix</h1> */}
                    <img
                        src={"../public/logo.png"}
                        alt={"HostelFix Logo"}
                        className="w-3/4 object-cover"
                    />
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
                            disabled={isLoading}
                        />
                    )}

                    <InputField
                        icon={Mail}
                        type="email"
                        placeholder={placeholder}
                        value={credential}
                        onChange={(e) => setCredential(e.target.value)}
                        autoComplete="off"
                        disabled={isLoading}
                    />

                    <InputField
                        icon={LogIn}
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                        disabled={isLoading}
                    />

                    <div className="mt-8">
                        <PrimaryButton type="submit" disabled={isLoading}>
                            {isLoading ? (
                                <div className="flex items-center justify-center">
                                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                    Signing In...
                                </div>
                            ) : 'Sign In'}
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
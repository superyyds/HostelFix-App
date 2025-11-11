import React, { useState, useEffect, useCallback, useRef } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import MessageBox from './components/MessageBox';
import { initializeApp } from "firebase/app";
import { getAuth, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, collection, query, where, getDocs, setLogLevel, onSnapshot, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';

// Pages
import LoginPage from './pages/LoginPage';
import PasswordRecoveryPage from './pages/PasswordRecoveryPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import RegisterUserPage from './pages/RegisterUserPage';
import StudentDashboard from './pages/StudentDashboard';
import WardenDashboard from './pages/WardenDashboard';
import StaffDashboard from './pages/StaffDashboard';
import ProfileManagementPage from './pages/ProfileManagementPage';
import ComplaintForm from './pages/ComplaintForm';
import ComplaintList from './pages/ComplaintList';
import ComplaintDetail from './pages/ComplaintDetail';
import FeedbackForm from './pages/FeedbackForm';
import FeedbackViewer from './pages/FeedbackViewer';
import FeedbackList from './pages/FeedbackList';
import { wardenSessionCache } from './api/cache';

// Firebase config (your existing config)
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
setLogLevel('debug');

// Firebase helper functions (your existing functions)
export const fetchUserRole = async (uid, email) => {
    try {
        const userDocRef = doc(db, 'users', uid);
        let userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
            const userData = userDoc.data();
            return {
                role: userData.role || 'student',
                mustChangePassword: userData.mustChangePassword || false,
                userData: userData,
                userDocId: uid
            };
        }

        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email.toLowerCase()));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            userDoc = querySnapshot.docs[0];
            const userData = userDoc.data();
            return {
                role: userData.role || 'student',
                mustChangePassword: userData.mustChangePassword || false,
                userData: userData,
                userDocId: userDoc.id
            };
        }

        return {
            role: 'student',
            mustChangePassword: true,
            userData: null,
            userDocId: uid
        };

    } catch (error) {
        throw new Error("Failed to validate user role against database.");
    }
};

const initialUserState = {
    userId: null,
    userDocId: null,
    role: null,
    loading: true,
    error: null,
    isAuthReady: false,
    mustChangePassword: false,
    isAuthenticated: false,
    forceMandatoryChange: false,
    userData: null,
};

const App = () => {
    const [appState, setAppState] = useState(initialUserState);
    const [isRegistering, setIsRegistering] = useState(false);
    const [lastWardenHash, setLastWardenHash] = useState(null);
    const [isLoginCheckFailed, setIsLoginCheckFailed] = useState(false);
    const [isMessageVisible, setIsMessageVisible] = useState(false);
    const [message, setMessage] = useState({ title: "", text: "", type: "" });
    const [isManualLogout, setIsManualLogout] = useState(false);
    
    // 🔑 CRITICAL FIX: Use refs for immediate lock checks
    const isRegisteringRef = useRef(false);
    const isLoginCheckFailedRef = useRef(false);
    
    const [complaints, setComplaints] = useState([]);
    const [selected, setSelected] = useState(null);
    const [feedbackList, setFeedbackList] = useState([]);
    const [editingFeedback, setEditingFeedback] = useState(null);

    // Consolidated close message handler
    const closeMessage = () => {
        setIsMessageVisible(false);
        // If we close a role mismatch/hostel ID mismatch error, we release the lock
        // so the user can try logging in again.
        if (message.title === "Role Mismatch" || (message.title === "Login Failed" && message.text.includes("Hostel ID"))) {
            handleLoginFailure(false); 
        }
    };

    // 🔑 SYNC REFS WITH STATE
    useEffect(() => {
        isRegisteringRef.current = isRegistering;
    }, [isRegistering]);

    useEffect(() => {
        isLoginCheckFailedRef.current = isLoginCheckFailed;
    }, [isLoginCheckFailed]);

    const getInitialView = useCallback(() => {
        const hash = window.location.hash.replace(/^#\/?/, '');
        const publicViews = ['password-recovery', 'login', 'change-password'];
        const allowedAuthViews = [
            'warden', 'student', 'staff', 
            'register-user', 'profile-management', 'change-password-voluntary',
            'complaintList', 'complaintDetail', 'complaintForm',
            'feedbackViewer', 'studentFeedbackList', 'feedbackForm'
        ];

        if (publicViews.includes(hash)) return hash;
        if (allowedAuthViews.includes(hash)) return hash;
        return 'login';
    }, []);

    const [view, setView] = useState(getInitialView());

    const handleViewChange = useCallback((newView) => {
        setView(prevView => {
            if (prevView !== newView) {
                window.location.hash = `/${newView}`;
                if (newView === 'register-user' && appState.role === 'warden') {
                    setLastWardenHash('register-user');
                }
                return newView;
            }
            return prevView;
        });
    }, [appState.role]);

    // Registration handlers
    const handleRegistrationStart = () => {
        isRegisteringRef.current = true;
        setIsRegistering(true);
    };

    const handleRegistrationComplete = (status = null, registrationData = null) => {
        isRegisteringRef.current = false;
        setIsRegistering(false);

        if (status === 'success') {
            setMessage({
                title: "Account Created! 🎉",
                text: `A new ${registrationData.role} account for ${registrationData.name} (${registrationData.uniqueId}) has been created successfully. Temporary Password: ${registrationData.tempPassword}. The user will be forced to change this password upon first login.`,
                type: "success"
            });
            setIsMessageVisible(true);
            setTimeout(() => setIsMessageVisible(false), 5000);
            handleViewChange('register-user');
        } else if (status === 'duplicate') {
            setMessage({
                title: "Duplicate Information Found",
                text: registrationData.errors.join('\n'),
                type: "error"
            });
            setIsMessageVisible(true);
            setTimeout(() => setIsMessageVisible(false), 5000);
            setLastWardenHash(null);
        } else if (status === 'error') {
            setLastWardenHash(null);
        } else {
            setLastWardenHash(null);
        }
    };

    // 🔥 CRITICAL FIX: Enhanced mandatory password change handler
    const handleMandatoryPasswordChange = (userData) => {
        setAppState(prev => ({
            ...prev,
            forceMandatoryChange: true,
            userId: userData.userId,
            userDocId: userData.userDocId,
            role: userData.userRole,
            isAuthenticated: true,
            userData: userData.userData || prev.userData
        }));
        handleViewChange('change-password');
    };

    // Route protection helper
    const protectRoute = (requiredRole) => {
        if (appState.role !== requiredRole) {
            return (
                <MessageBox
                    title="Access Denied"
                    text={`This page is only accessible to ${requiredRole} accounts. Your role is: ${appState.role}`}
                    type="error"
                    onClose={() => handleViewChange(appState.role)}
                />
            );
        }
        return null;
    };

    // 🔑 CRITICAL FIX: Enhanced Auth State Listener with Role Mismatch Protection
    useEffect(() => {
        let isInitialLoad = true;
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            console.log("🔍 DEBUG: Auth state changed - User:", user ? "Signed in" : "Signed out");

            if (isManualLogout) {
                console.log("🔒 DEBUG: Manual logout in progress - ignoring auth state change");
                return;
            }

            // 🔑 CRITICAL FIX: Use refs for immediate checks (state updates are async)
            if (isLoginCheckFailedRef.current) {
                // Do not reset state, just ignore the auth change until the lock is released.
                return;
            }

            if (isRegisteringRef.current) {
                return;
            }

            // Also check state for consistency
            if (isRegistering) {
                return;
            }

            if (user) {
                try {
                    const userData = await fetchUserRole(user.uid, user.email);
                    if (!userData || !userData.role) {
                        throw new Error("User document or role data is missing or corrupted.");
                    }

                    setAppState(prev => ({
                        ...prev,
                        userId: user.uid,
                        userDocId: userData.userDocId,
                        role: userData.role,
                        isAuthenticated: true,
                        isAuthReady: true,
                        loading: false,
                        mustChangePassword: userData.mustChangePassword,
                        forceMandatoryChange: userData.mustChangePassword,
                        userData: userData.userData,
                        error: null
                    }));

                    const currentHash = window.location.hash.replace(/^#\/?/, '');

                    // 🔥 CRITICAL FIX: Handle mandatory password changes for ALL roles
                    if (userData.mustChangePassword) {
                        
                        // ✅ Set state to show change password page WITHOUT signing out
                        setAppState(prev => ({
                            ...prev,
                            forceMandatoryChange: true,
                            userId: user.uid,
                            userDocId: userData.userDocId,
                            role: userData.role,
                            isAuthenticated: true, // ✅ Keep authenticated
                            userData: userData.userData
                        }));
                        
                        handleViewChange('change-password');
                        return;
                    }

                    // 🔑 ENHANCED: Detect role mismatch scenarios
                    // If user is authenticated but still on login page, don't redirect immediately
                    // This allows LoginPage to show error messages
                    if (currentHash === 'login') {
                        console.log("🔍 DEBUG: User authenticated but still on login page - allowing time for error handling");
                        // Don't redirect immediately - let LoginPage handle role mismatch errors
                        return;
                    }

                    // Enhanced register page protection
                    if (currentHash === 'register-user') {
                        if (userData.role === 'warden') {
                            return;
                        }
                        handleViewChange(userData.role);
                        return;
                    }

                    // Warden register page priority
                    if (userData.role === 'warden' && lastWardenHash === 'register-user') {
                        handleViewChange('register-user');
                        return;
                    }

                    // Only redirect away from public pages (but with delay for login)
                    if (currentHash === 'password-recovery') {
                        handleViewChange(userData.role);
                        return;
                    }

                    // If no specific routing needed and no current hash, go to role-based dashboard
                    if (!currentHash || currentHash === '') {
                        handleViewChange(userData.role);
                    }

                } catch (error) {
                    await signOut(auth);
                    setAppState(prev => ({
                        ...initialUserState,
                        loading: false,
                        isAuthReady: true,
                        error: "Failed to load user data. Please log in again."
                    }));
                    handleViewChange('login');
                }
            } else {
                // User is signed out
                console.log("🔍 DEBUG: User signed out - resetting state");
                setAppState({
                    ...initialUserState,
                    loading: false,
                    isAuthReady: true
                });
                setLastWardenHash(null);
                handleViewChange("login");
            }

            isInitialLoad = false;
        });

        return () => unsubscribe();
    }, [isRegistering, lastWardenHash, isLoginCheckFailed, isManualLogout]);

    // Feedback fetching
    useEffect(() => {
        if (!appState.isAuthReady) return;
        let unsubscribe = () => { };
        const fetchFeedbacks = async () => {
            try {
                const q = query(collection(db, "feedbacks"));
                unsubscribe = onSnapshot(q, (snapshot) => {
                    const data = snapshot.docs.map((doc) => ({
                        id: doc.id,
                        ...doc.data(),
                    }));
                    setFeedbackList(data);
                }, (error) => {
                    console.error("Error fetching feedbacks (onSnapshot): ", error);
                });
            } catch (error) {
                console.error("Error setting up feedback listener: ", error);
            }
        };
        fetchFeedbacks();
        return () => {
            console.log("Cleaning up feedback listener.");
            unsubscribe();
        };
    }, [appState.isAuthReady]);

    // Other handlers
    const handleProfileUpdate = (updatedUserDataFromChild) => {
        console.log("APP_STATE: Profile data is being updated globally.", updatedUserDataFromChild);
        setAppState(prev => ({ ...prev, userData: updatedUserDataFromChild }));
    };

    const handleLoginSuccess = () => {
        console.log("✅ DEBUG: Login success signal received from LoginPage. Releasing lock and allowing redirects.");
        // Clear any lingering login failure locks
        handleLoginFailure(false); 
        closeMessage(); // Ensure any previous message is cleared
    };
    
    // 🔑 ENHANCED: Handle login failure with immediate ref update
    const handleLoginFailure = (failed) => {
        isLoginCheckFailedRef.current = failed; // Immediate ref update
        setIsLoginCheckFailed(failed); // State update
        
        // Auto-reset the lock after 3 seconds to prevent permanent lock, unless a persistent message is showing
        if (failed && !isMessageVisible) {
            setTimeout(() => {
                isLoginCheckFailedRef.current = false;
                setIsLoginCheckFailed(false);
            }, 3000);
        }
    };
    
    // 🔑 UPDATED HANDLER: Now sets the message/visibility state directly
    const handleValidationFailure = async (title, text) => {
        // 1. Set the global message and make it visible
        setMessage({ title, text, type: "error" });
        setIsMessageVisible(true);

        // 2. Set the login check failed lock (prevents auth listener from redirecting)
        handleLoginFailure(true); 

        // 3. Force sign out the user that was logged in briefly 
        try {
            await signOut(auth);
        } catch (error) {
        }
    };

    const handleForcedPasswordChangeComplete = async () => {
        try {
            if (!appState.userDocId) throw new Error("No user document ID found in state.");
            const userDocRef = doc(db, 'users', appState.userDocId);
            await updateDoc(userDocRef, { mustChangePassword: false });
            setAppState(prev => ({ ...prev, mustChangePassword: false, forceMandatoryChange: false }));
            handleViewChange(appState.role);
        } catch (error) {
            setMessage({ title: "Update Failed", text: "Your password was changed, but we failed to save the update. Please try again or contact support.", type: "error" });
            setIsMessageVisible(true);
        }
    };

    const handleLogout = async () => {
        try {
            setIsManualLogout(true);
            setLastWardenHash(null);
            wardenSessionCache.email = null;
            wardenSessionCache.password = null;
            await signOut(auth);
            handleViewChange("login");
            setTimeout(() => {
                setIsManualLogout(false);
            }, 1000);
        } catch (error) {
            wardenSessionCache.email = null;
            wardenSessionCache.password = null;
            setIsManualLogout(false);
        }
    };
    
    const handleForgotPasswordClick = () => handleViewChange("password-recovery");
    const handleBackToLogin = () => handleViewChange("login");
    const handleCreateComplaint = (complaint) => setComplaints((prev) => [complaint, ...prev]);

const handleFeedbackSubmit = async (feedback) => {
    try {
        const feedbacksRef = collection(db, "feedbacks");
        const docRef = await addDoc(feedbacksRef, {
            ...feedback,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            userId: appState.userId,
            userEmail: appState.userData?.email || "",
            userName: appState.userData?.name || "",
            status: 'submitted',
            reviewed: false
        });
        
        setMessage({
            title: "Feedback Submitted!",
            text: "Your feedback has been recorded successfully.",
            type: "success"
        });
        setIsMessageVisible(true);
        
        // Auto-hide success message after 3 seconds
        setTimeout(() => {
            setIsMessageVisible(false);
        }, 3000);

    } catch (error) {
        setMessage({
            title: "Submission Failed",
            text: "Failed to submit feedback. Please try again.",
            type: "error"
        });
        setIsMessageVisible(true);
    }
};

const handleDeleteFeedback = async (id) => {
    try {
        console.log("🗑️ DEBUG: Deleting feedback with ID:", id);
        
        // Check if user owns this feedback (security check)
        const feedbackToDelete = feedbackList.find(f => f.id === id);
        if (!feedbackToDelete) {
            throw new Error("Feedback not found");
        }
        
        if (feedbackToDelete.userId !== appState.userId && appState.role !== 'warden') {
            throw new Error("You can only delete your own feedback");
        }

        const feedbackRef = doc(db, "feedbacks", id);
        await deleteDoc(feedbackRef);
        
        setMessage({
            title: "Feedback Deleted",
            text: "Your feedback has been deleted successfully.",
            type: "success"
        });
        setIsMessageVisible(true);
        
        setTimeout(() => {
            setIsMessageVisible(false);
        }, 3000);

    } catch (error) {
        setMessage({
            title: "Deletion Failed",
            text: error.message || "Failed to delete feedback. Please try again.",
            type: "error"
        });
        setIsMessageVisible(true);
    }
};

const handleEditFeedback = (feedback) => {
    setEditingFeedback(feedback);
    handleViewChange("feedbackForm");
};

const handleCancelEdit = () => {
    setEditingFeedback(null);
    handleViewChange("studentFeedbackList");
};

const handleMarkReviewed = async (id) => {
    try {
        
        if (appState.role !== 'warden') {
            throw new Error("Only wardens can mark feedback as reviewed");
        }

        const feedbackRef = doc(db, "feedbacks", id);
        await updateDoc(feedbackRef, {
            reviewed: true,
            reviewedAt: new Date().toISOString(),
            reviewedBy: appState.userData?.name || appState.userId,
            updatedAt: new Date().toISOString()
        });
        
        
        setMessage({
            title: "Feedback Reviewed",
            text: "Feedback has been marked as reviewed.",
            type: "success"
        });
        setIsMessageVisible(true);
        
        setTimeout(() => {
            setIsMessageVisible(false);
        }, 3000);

    } catch (error) {

        setMessage({
            title: "Update Failed",
            text: error.message || "Failed to mark feedback as reviewed. Please try again.",
            type: "error"
        });
        setIsMessageVisible(true);
    }
};

    const renderView = () => {
        if (appState.loading || !appState.isAuthReady || isRegistering) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-50">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mr-3" />
                    <p className="text-xl text-indigo-700 font-semibold">
                        {isRegistering ? "Creating account and restoring session..." : "Connecting to HostelFix..."}
                    </p>
                </div>
            );
        }

        if (appState.error) {
            return (
                <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 p-4">
                    <AlertTriangle className="w-12 h-12 text-red-600 mb-4" />
                    <h2 className="text-2xl font-bold text-red-800 mb-2">System Error</h2>
                    <p className="text-red-700">{appState.error}</p>
                    <button onClick={handleBackToLogin} className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition duration-150">
                        Back to Login
                    </button>
                </div>
            );
        }

        if (!appState.isAuthenticated) {
            switch (view) {
                case "password-recovery": return <PasswordRecoveryPage onBackToLogin={handleBackToLogin} />;
                case "login":
                default: return <LoginPage 
                    onLoginSuccess={handleLoginSuccess} 
                    onForgotPassword={handleForgotPasswordClick} 
                    onLoginFailure={handleLoginFailure} 
                    onValidationFailure={handleValidationFailure}
                    onMandatoryPasswordChange={handleMandatoryPasswordChange}
                />;
            }
        }

        // Mandatory Password Change Gate - Now applies to ALL roles
        if (appState.forceMandatoryChange) {
            if (view !== "change-password") handleViewChange('change-password');
            return <ChangePasswordPage onPasswordChangeComplete={handleForcedPasswordChangeComplete} userId={appState.userId} userDocId={appState.userDocId} userRole={appState.role} isVoluntary={false} onCancel={null} />;
        }

        // ROUTE PROTECTION - All routes now have role-based access control
        switch (view) {
            case "student":
                const studentCheck = protectRoute('student');
                if (studentCheck) return studentCheck;
                return <StudentDashboard onLogout={handleLogout} name={appState.userData?.name || ""} hostelId={appState.userData?.hostelId || ""} userRole={appState.role} onViewChange={handleViewChange} />;

            case "warden":
                const wardenCheck = protectRoute('warden');
                if (wardenCheck) return wardenCheck;
                return <WardenDashboard onLogout={handleLogout} userId={appState.userId} userDocId={appState.userDocId} userRole={appState.role} onViewChange={handleViewChange} />;
            
            case "staff":
                const staffCheck = protectRoute('staff');
                if (staffCheck) return staffCheck;
                return <StaffDashboard onLogout={handleLogout} name={appState.userData?.name || ""} staffWardenId={appState.userData?.staffWardenId || ""} userRole={appState.role} onViewChange={handleViewChange} />;
                
            case "register-user":
                const registerCheck = protectRoute('warden');
                if (registerCheck) return registerCheck;
                return <RegisterUserPage onBackToDashboard={() => handleViewChange("warden")} onRegistrationStart={handleRegistrationStart} onRegistrationComplete={handleRegistrationComplete} />;

            case "profile-management":
                if (!appState.userData) {
                    return (
                        <div className="min-h-screen flex items-center justify-center bg-gray-50">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mr-3" />
                            <p className="text-xl text-indigo-700 font-semibold">Loading Profile...</p>
                        </div>
                    );
                }
                return <ProfileManagementPage appState={appState} onBackToDashboard={() => handleViewChange(appState.role)} onPasswordChange={() => handleViewChange("change-password-voluntary")} onProfileUpdated={handleProfileUpdate} />;

            case "change-password-voluntary":
                return <ChangePasswordPage onPasswordChangeComplete={() => handleViewChange(appState.role)} userId={appState.userId} userDocId={appState.userDocId} userRole={appState.role} isVoluntary={true} onCancel={() => handleViewChange("profile-management")} />;

            case "complaintForm":
            case "complaintList":
            case "complaintDetail":
                const complaintCheck = protectRoute('student');
                if (complaintCheck) return complaintCheck;
                break;

            case "feedbackViewer":
                const feedbackViewerCheck = protectRoute('warden');
                if (feedbackViewerCheck) return feedbackViewerCheck;
                return <FeedbackViewer feedbackList={feedbackList} onBack={() => handleViewChange("warden")} onMarkReviewed={handleMarkReviewed} />;

            case "studentFeedbackList":
                const studentFeedbackCheck = protectRoute('student');
                if (studentFeedbackCheck) return studentFeedbackCheck;
                const studentFeedback = feedbackList.filter((f) => f.userId === appState.userId);
                return <FeedbackList feedbackList={studentFeedback} onBack={() => handleViewChange("student")} onDeleteFeedback={handleDeleteFeedback} onEditFeedback={handleEditFeedback} />;

            case "feedbackForm":
                const feedbackFormCheck = protectRoute('student');
                if (feedbackFormCheck) return feedbackFormCheck;
                return <FeedbackForm onBack={() => handleViewChange("student")} onSubmitFeedback={handleFeedbackSubmit} editingFeedback={editingFeedback} onCancelEdit={handleCancelEdit} currentUser={appState.userData} complaintList={selected} />;

            default:
                // Redirect to appropriate dashboard based on actual role
                handleViewChange(appState.role);
                return (
                    <div className="min-h-screen flex items-center justify-center bg-gray-50">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mr-3" />
                        <p className="text-xl text-indigo-700 font-semibold">Redirecting to your dashboard...</p>
                    </div>
                );
        }

        // Fallback for complaint routes
        switch (view) {
            case "complaintForm":
                return <ComplaintForm currentUser={appState.userData} onCreate={handleCreateComplaint} onClose={() => handleViewChange("student")} />;
            case "complaintList":
                return <ComplaintList currentUser={appState.userData} onSelect={c=> { setSelected(c); handleViewChange("complaintDetail"); }} onBack={() => { setSelected(null); handleViewChange(appState.role); }} />;
            case "complaintDetail":
                return <ComplaintDetail complaint={selected} currentUser={appState.userData} onClose={() => { setSelected(null); handleViewChange("complaintList") }} onGiveFeedback={() => handleViewChange("feedbackForm")} />;
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen font-sans bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
            {/* Renders global and local messages, including the persistent login errors */}
            {isMessageVisible && <MessageBox title={message.title} text={message.text} type={message.type} onClose={closeMessage} />}
            {renderView()}
        </div>
    );
};

export default App;

// import React, { useState, useEffect, useCallback, useRef } from "react";
// import { AlertTriangle, Loader2 } from "lucide-react";
// import MessageBox from './components/MessageBox';
// import { initializeApp } from "firebase/app";
// import { getAuth, signOut, onAuthStateChanged } from 'firebase/auth';
// import { getFirestore, doc, getDoc, collection, query, where, getDocs, setLogLevel, onSnapshot, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';

// // Pages
// import LoginPage from './pages/LoginPage';
// import PasswordRecoveryPage from './pages/PasswordRecoveryPage';
// import ChangePasswordPage from './pages/ChangePasswordPage';
// import RegisterUserPage from './pages/RegisterUserPage';
// import StudentDashboard from './pages/StudentDashboard';
// import WardenDashboard from './pages/WardenDashboard';
// import StaffDashboard from './pages/StaffDashboard';
// import ProfileManagementPage from './pages/ProfileManagementPage';
// import ComplaintForm from './pages/ComplaintForm';
// import ComplaintList from './pages/ComplaintList';
// import ComplaintDetail from './pages/ComplaintDetail';
// import FeedbackForm from './pages/FeedbackForm';
// import FeedbackViewer from './pages/FeedbackViewer';
// import FeedbackList from './pages/FeedbackList';
// import { wardenSessionCache } from './api/cache';

// // Firebase config (your existing config)
// const firebaseConfig = {
//     apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
//     authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
//     projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
//     storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
//     messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
//     appId: import.meta.env.VITE_FIREBASE_APP_ID,
//     measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
// };

// const app = initializeApp(firebaseConfig);
// export const auth = getAuth(app);
// export const db = getFirestore(app);
// setLogLevel('debug');

// // Firebase helper functions (your existing functions)
// export const fetchUserRole = async (uid, email) => {
//     try {
//         const userDocRef = doc(db, 'users', uid);
//         let userDoc = await getDoc(userDocRef);

//         if (userDoc.exists()) {
//             const userData = userDoc.data();
//             return {
//                 role: userData.role || 'student',
//                 mustChangePassword: userData.mustChangePassword || false,
//                 userData: userData,
//                 userDocId: uid
//             };
//         }

//         const usersRef = collection(db, 'users');
//         const q = query(usersRef, where('email', '==', email.toLowerCase()));
//         const querySnapshot = await getDocs(q);

//         if (!querySnapshot.empty) {
//             userDoc = querySnapshot.docs[0];
//             const userData = userDoc.data();
//             return {
//                 role: userData.role || 'student',
//                 mustChangePassword: userData.mustChangePassword || false,
//                 userData: userData,
//                 userDocId: userDoc.id
//             };
//         }

//         return {
//             role: 'student',
//             mustChangePassword: true,
//             userData: null,
//             userDocId: uid
//         };

//     } catch (error) {
//         console.error("❌ DEBUG: Error fetching user role:", error);
//         throw new Error("Failed to validate user role against database.");
//     }
// };

// const initialUserState = {
//     userId: null,
//     userDocId: null,
//     role: null,
//     loading: true,
//     error: null,
//     isAuthReady: false,
//     mustChangePassword: false,
//     isAuthenticated: false,
//     forceMandatoryChange: false,
//     userData: null,
// };

// const App = () => {
//     const [appState, setAppState] = useState(initialUserState);
//     const [isRegistering, setIsRegistering] = useState(false);
//     const [lastWardenHash, setLastWardenHash] = useState(null);
//     const [isLoginCheckFailed, setIsLoginCheckFailed] = useState(false);
//     const [isMessageVisible, setIsMessageVisible] = useState(false);
//     const [message, setMessage] = useState({ title: "", text: "", type: "" });
//     const [isManualLogout, setIsManualLogout] = useState(false);
    
//     // 🔑 CRITICAL FIX: Use refs for immediate lock checks
//     const isRegisteringRef = useRef(false);
//     const isLoginCheckFailedRef = useRef(false);
    
//     const [complaints, setComplaints] = useState([]);
//     const [selected, setSelected] = useState(null);
//     const [feedbackList, setFeedbackList] = useState([]);
//     const [editingFeedback, setEditingFeedback] = useState(null);

//     // Consolidated close message handler
//     const closeMessage = () => {
//         setIsMessageVisible(false);
//         // If we close a role mismatch/hostel ID mismatch error, we release the lock
//         // so the user can try logging in again.
//         if (message.title === "Role Mismatch" || (message.title === "Login Failed" && message.text.includes("Hostel ID"))) {
//             handleLoginFailure(false); 
//         }
//     };

//     // 🔑 SYNC REFS WITH STATE
//     useEffect(() => {
//         isRegisteringRef.current = isRegistering;
//         console.log("🔄 DEBUG: Registration ref synced with state:", isRegistering);
//     }, [isRegistering]);

//     useEffect(() => {
//         isLoginCheckFailedRef.current = isLoginCheckFailed;
//         console.log("🔄 DEBUG: Login check failed ref synced with state:", isLoginCheckFailed);
//     }, [isLoginCheckFailed]);

//     const getInitialView = useCallback(() => {
//         const hash = window.location.hash.replace(/^#\/?/, '');
//         const publicViews = ['password-recovery', 'login', 'change-password'];
//         const allowedAuthViews = [
//             'warden', 'student', 'staff', 
//             'register-user', 'profile-management', 'change-password-voluntary',
//             'complaintList', 'complaintDetail', 'complaintForm',
//             'feedbackViewer', 'studentFeedbackList', 'feedbackForm'
//         ];

//         if (publicViews.includes(hash)) return hash;
//         if (allowedAuthViews.includes(hash)) return hash;
//         return 'login';
//     }, []);

//     const [view, setView] = useState(getInitialView());

//     const handleViewChange = useCallback((newView) => {
//         setView(prevView => {
//             if (prevView !== newView) {
//                 window.location.hash = `/${newView}`;
//                 if (newView === 'register-user' && appState.role === 'warden') {
//                     setLastWardenHash('register-user');
//                 }
//                 return newView;
//             }
//             return prevView;
//         });
//     }, [appState.role]);

//     // Registration handlers
//     const handleRegistrationStart = () => {
//         console.log("🔒 DEBUG: Starting registration - setting immediate lock");
//         isRegisteringRef.current = true;
//         setIsRegistering(true);
//     };

//     const handleRegistrationComplete = (status = null, registrationData = null) => {
//         console.log("🔒 DEBUG: Registration complete - releasing lock");
//         isRegisteringRef.current = false;
//         setIsRegistering(false);

//         if (status === 'success') {
//             setMessage({
//                 title: "Account Created! 🎉",
//                 text: `A new ${registrationData.role} account for ${registrationData.name} (${registrationData.uniqueId}) has been created successfully. Temporary Password: ${registrationData.tempPassword}. The user will be forced to change this password upon first login.`,
//                 type: "success"
//             });
//             setIsMessageVisible(true);
//             setTimeout(() => setIsMessageVisible(false), 5000);
//             handleViewChange('register-user');
//         } else if (status === 'duplicate') {
//             setMessage({
//                 title: "Duplicate Information Found",
//                 text: registrationData.errors.join('\n'),
//                 type: "error"
//             });
//             setIsMessageVisible(true);
//             setTimeout(() => setIsMessageVisible(false), 5000);
//             setLastWardenHash(null);
//         } else if (status === 'error') {
//             setLastWardenHash(null);
//         } else {
//             setLastWardenHash(null);
//         }
//     };

//     // 🔥 CRITICAL FIX: Add handler for mandatory password changes
//     const handleMandatoryPasswordChange = (userData) => {
//         console.log("🔄 DEBUG: Mandatory password change required for:", userData);
//         setAppState(prev => ({
//             ...prev,
//             forceMandatoryChange: true,
//             userId: userData.userId,
//             userDocId: userData.userDocId,
//             role: userData.userRole
//         }));
//         handleViewChange('change-password');
//     };

//     // Route protection helper
//     const protectRoute = (requiredRole) => {
//         if (appState.role !== requiredRole) {
//             console.log(`🚫 UNAUTHORIZED: User role '${appState.role}' trying to access route requiring: ${requiredRole}`);
//             return (
//                 <MessageBox
//                     title="Access Denied"
//                     text={`This page is only accessible to ${requiredRole} accounts. Your role is: ${appState.role}`}
//                     type="error"
//                     onClose={() => handleViewChange(appState.role)}
//                 />
//             );
//         }
//         return null;
//     };

//     // 🔑 CRITICAL FIX: Enhanced Auth State Listener with Role Mismatch Protection
//     useEffect(() => {
//         let isInitialLoad = true;
//         const unsubscribe = onAuthStateChanged(auth, async (user) => {
//             console.log("🔍 DEBUG: Auth state changed - User:", user ? "Signed in" : "Signed out");

//             if (isManualLogout) {
//                 console.log("🔒 DEBUG: Manual logout in progress - ignoring auth state change");
//                 return;
//             }

//             // 🔑 CRITICAL FIX: Use refs for immediate checks (state updates are async)
//             if (isLoginCheckFailedRef.current) {
//                 console.log("🔒 DEBUG: LOGIN CHECK FAILED - ignoring ALL auth changes (role mismatch scenario)");
//                 // Do not reset state, just ignore the auth change until the lock is released.
//                 return;
//             }

//             if (isRegisteringRef.current) {
//                 console.log("🔒 DEBUG: REGISTRATION LOCK ACTIVE - ignoring ALL auth changes");
//                 return;
//             }

//             // Also check state for consistency
//             if (isRegistering) {
//                 console.log("🔒 DEBUG: Registration state lock active");
//                 return;
//             }

//             if (user) {
//                 try {
//                     const userData = await fetchUserRole(user.uid, user.email);
//                     if (!userData || !userData.role) {
//                         throw new Error("User document or role data is missing or corrupted.");
//                     }

//                     setAppState(prev => ({
//                         ...prev,
//                         userId: user.uid,
//                         userDocId: userData.userDocId,
//                         role: userData.role,
//                         isAuthenticated: true,
//                         isAuthReady: true,
//                         loading: false,
//                         mustChangePassword: userData.mustChangePassword,
//                         forceMandatoryChange: userData.mustChangePassword,
//                         userData: userData.userData,
//                         error: null
//                     }));

//                     const currentHash = window.location.hash.replace(/^#\/?/, '');
//                     console.log("🔧 DEBUG: Auth state change - Current hash:", currentHash, "Role:", userData.role);

//                     // 🔑 ENHANCED: Detect role mismatch scenarios
//                     // If user is authenticated but still on login page, don't redirect immediately
//                     // This allows LoginPage to show error messages
//                     if (currentHash === 'login') {
//                         console.log("🔍 DEBUG: User authenticated but still on login page - allowing time for error handling");
//                         // Don't redirect immediately - let LoginPage handle role mismatch errors
//                         return;
//                     }

//                     // Enhanced register page protection
//                     if (currentHash === 'register-user') {
//                         console.log("🔧 DEBUG: USER IS ON REGISTER PAGE - BLOCKING ALL NAVIGATION");
//                         if (userData.role === 'warden') {
//                             console.log("🔧 DEBUG: Warden confirmed on register page - NO NAVIGATION");
//                             return;
//                         }
//                         console.log("🔧 DEBUG: Non-warden on register page - redirecting to dashboard");
//                         handleViewChange(userData.role);
//                         return;
//                     }

//                     // Warden register page priority
//                     if (userData.role === 'warden' && lastWardenHash === 'register-user') {
//                         console.log("🔧 DEBUG: Warden returning to register page from cache");
//                         handleViewChange('register-user');
//                         return;
//                     }

//                     // 🔥 CRITICAL FIX: Handle mandatory password changes for ALL roles (not just students)
//                     if (userData.mustChangePassword) {
//                         console.log("🔄 DEBUG: Mandatory password change required for:", userData.role);
//                         handleViewChange('change-password');
//                         return;
//                     }

//                     // Only redirect away from public pages (but with delay for login)
//                     if (currentHash === 'password-recovery') {
//                         handleViewChange(userData.role);
//                         return;
//                     }

//                     // If no specific routing needed and no current hash, go to role-based dashboard
//                     if (!currentHash || currentHash === '') {
//                         handleViewChange(userData.role);
//                     }

//                 } catch (error) {
//                     console.error("❌ CRITICAL AUTH/ROLE CHECK ERROR:", error);
//                     await signOut(auth);
//                     setAppState(prev => ({
//                         ...initialUserState,
//                         loading: false,
//                         isAuthReady: true,
//                         error: "Failed to load user data. Please log in again."
//                     }));
//                     handleViewChange('login');
//                 }
//             } else {
//                 // User is signed out
//                 console.log("🔍 DEBUG: User signed out - resetting state");
//                 setAppState({
//                     ...initialUserState,
//                     loading: false,
//                     isAuthReady: true
//                 });
//                 setLastWardenHash(null);
//                 handleViewChange("login");
//             }

//             isInitialLoad = false;
//         });

//         return () => unsubscribe();
//     }, [isRegistering, lastWardenHash, isLoginCheckFailed, isManualLogout]);

//     // Feedback fetching
//     useEffect(() => {
//         if (!appState.isAuthReady) return;
//         let unsubscribe = () => { };
//         const fetchFeedbacks = async () => {
//             try {
//                 const q = query(collection(db, "feedbacks"));
//                 unsubscribe = onSnapshot(q, (snapshot) => {
//                     const data = snapshot.docs.map((doc) => ({
//                         id: doc.id,
//                         ...doc.data(),
//                     }));
//                     setFeedbackList(data);
//                 }, (error) => {
//                     console.error("Error fetching feedbacks (onSnapshot): ", error);
//                 });
//             } catch (error) {
//                 console.error("Error setting up feedback listener: ", error);
//             }
//         };
//         fetchFeedbacks();
//         return () => {
//             console.log("Cleaning up feedback listener.");
//             unsubscribe();
//         };
//     }, [appState.isAuthReady]);

//     // Other handlers
//     const handleProfileUpdate = (updatedUserDataFromChild) => {
//         console.log("APP_STATE: Profile data is being updated globally.", updatedUserDataFromChild);
//         setAppState(prev => ({ ...prev, userData: updatedUserDataFromChild }));
//     };

//     const handleLoginSuccess = () => {
//         console.log("✅ DEBUG: Login success signal received from LoginPage. Releasing lock and allowing redirects.");
//         // Clear any lingering login failure locks
//         handleLoginFailure(false); 
//         closeMessage(); // Ensure any previous message is cleared
//     };
    
//     // 🔑 ENHANCED: Handle login failure with immediate ref update
//     const handleLoginFailure = (failed) => {
//         console.log("🔒 DEBUG: Login failure lock set to:", failed);
//         isLoginCheckFailedRef.current = failed; // Immediate ref update
//         setIsLoginCheckFailed(failed); // State update
        
//         // Auto-reset the lock after 3 seconds to prevent permanent lock, unless a persistent message is showing
//         if (failed && !isMessageVisible) {
//             setTimeout(() => {
//                 console.log("🔄 DEBUG: Auto-resetting login failure lock");
//                 isLoginCheckFailedRef.current = false;
//                 setIsLoginCheckFailed(false);
//             }, 3000);
//         }
//     };
    
//     // 🔑 UPDATED HANDLER: Now sets the message/visibility state directly
//     const handleValidationFailure = async (title, text) => {
//         console.log("🔴 DEBUG: Validation failure received. Setting global error message and signout lock.");
        
//         // 1. Set the global message and make it visible
//         setMessage({ title, text, type: "error" });
//         setIsMessageVisible(true);

//         // 2. Set the login check failed lock (prevents auth listener from redirecting)
//         handleLoginFailure(true); 

//         // 3. Force sign out the user that was logged in briefly 
//         try {
//             await signOut(auth);
//             console.log("🚪 Forced sign out successful after validation failure.");
//         } catch (error) {
//             console.error("Error during forced signout:", error);
//         }
//     };

//     const handleForcedPasswordChangeComplete = async () => {
//         try {
//             if (!appState.userDocId) throw new Error("No user document ID found in state.");
//             const userDocRef = doc(db, 'users', appState.userDocId);
//             await updateDoc(userDocRef, { mustChangePassword: false });
//             setAppState(prev => ({ ...prev, mustChangePassword: false, forceMandatoryChange: false }));
//             handleViewChange(appState.role);
//         } catch (error) {
//             console.error("CRITICAL: Failed to update mustChangePassword flag in database:", error);
//             setMessage({ title: "Update Failed", text: "Your password was changed, but we failed to save the update. Please try again or contact support.", type: "error" });
//             setIsMessageVisible(true);
//         }
//     };

//     const handleLogout = async () => {
//         try {
//             setIsManualLogout(true);
//             setLastWardenHash(null);
//             wardenSessionCache.email = null;
//             wardenSessionCache.password = null;
//             console.log("🚪 Starting manual logout...");
//             await signOut(auth);
//             console.log("✅ Manual logout completed");
//             handleViewChange("login");
//             setTimeout(() => {
//                 setIsManualLogout(false);
//                 console.log("🔄 Manual logout flag reset");
//             }, 1000);
//         } catch (error) {
//             console.error("Logout error:", error);
//             wardenSessionCache.email = null;
//             wardenSessionCache.password = null;
//             setIsManualLogout(false);
//         }
//     };
    
//     const handleForgotPasswordClick = () => handleViewChange("password-recovery");
//     const handleBackToLogin = () => handleViewChange("login");
//     const handleCreateComplaint = (complaint) => setComplaints((prev) => [complaint, ...prev]);

//     // Feedback handlers (omitted for brevity, assume unchanged)
//     const handleFeedbackSubmit = async (feedback) => { /* ... */ };
//     const handleDeleteFeedback = async (id) => { /* ... */ };
//     const handleEditFeedback = (feedback) => { /* ... */ };
//     const handleCancelEdit = () => { /* ... */ };
//     const handleMarkReviewed = async (id) => { /* ... */ };

//     const renderView = () => {
//         if (appState.loading || !appState.isAuthReady || isRegistering) {
//             return (
//                 <div className="min-h-screen flex items-center justify-center bg-gray-50">
//                     <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mr-3" />
//                     <p className="text-xl text-indigo-700 font-semibold">
//                         {isRegistering ? "Creating account and restoring session..." : "Connecting to HostelFix..."}
//                     </p>
//                 </div>
//             );
//         }

//         if (appState.error) {
//             return (
//                 <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 p-4">
//                     <AlertTriangle className="w-12 h-12 text-red-600 mb-4" />
//                     <h2 className="text-2xl font-bold text-red-800 mb-2">System Error</h2>
//                     <p className="text-red-700">{appState.error}</p>
//                     <button onClick={handleBackToLogin} className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition duration-150">
//                         Back to Login
//                     </button>
//                 </div>
//             );
//         }

//         if (!appState.isAuthenticated) {
//             switch (view) {
//                 case "password-recovery": return <PasswordRecoveryPage onBackToLogin={handleBackToLogin} />;
//                 case "login":
//                 default: return <LoginPage 
//                     onLoginSuccess={handleLoginSuccess} 
//                     onForgotPassword={handleForgotPasswordClick} 
//                     onLoginFailure={handleLoginFailure} 
//                     onValidationFailure={handleValidationFailure}
//                     onMandatoryPasswordChange={handleMandatoryPasswordChange} // 🔥 CRITICAL FIX: Added this prop
//                 />;
//             }
//         }

//         // Mandatory Password Change Gate - Now applies to ALL roles
//         if (appState.forceMandatoryChange) {
//             if (view !== "change-password") handleViewChange("change-password");
//             return <ChangePasswordPage onPasswordChangeComplete={handleForcedPasswordChangeComplete} userId={appState.userId} userDocId={appState.userDocId} userRole={appState.role} isVoluntary={false} onCancel={null} />;
//         }

//         // ROUTE PROTECTION - All routes now have role-based access control
//         switch (view) {
//             case "student":
//                 const studentCheck = protectRoute('student');
//                 if (studentCheck) return studentCheck;
//                 return <StudentDashboard onLogout={handleLogout} name={appState.userData?.name || ""} hostelId={appState.userData?.hostelId || ""} userRole={appState.role} onViewChange={handleViewChange} />;

//             case "warden":
//                 const wardenCheck = protectRoute('warden');
//                 if (wardenCheck) return wardenCheck;
//                 return <WardenDashboard onLogout={handleLogout} userId={appState.userId} userDocId={appState.userDocId} userRole={appState.role} onViewChange={handleViewChange} />;
            
//             case "staff":
//                 const staffCheck = protectRoute('staff');
//                 if (staffCheck) return staffCheck;
//                 return <StaffDashboard onLogout={handleLogout} name={appState.userData?.name || ""} staffWardenId={appState.userData?.staffWardenId || ""} userRole={appState.role} onViewChange={handleViewChange} />;
                
//             case "register-user":
//                 const registerCheck = protectRoute('warden');
//                 if (registerCheck) return registerCheck;
//                 return <RegisterUserPage onBackToDashboard={() => handleViewChange("warden")} onRegistrationStart={handleRegistrationStart} onRegistrationComplete={handleRegistrationComplete} />;

//             case "profile-management":
//                 if (!appState.userData) {
//                     return (
//                         <div className="min-h-screen flex items-center justify-center bg-gray-50">
//                             <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mr-3" />
//                             <p className="text-xl text-indigo-700 font-semibold">Loading Profile...</p>
//                         </div>
//                     );
//                 }
//                 return <ProfileManagementPage appState={appState} onBackToDashboard={() => handleViewChange(appState.role)} onPasswordChange={() => handleViewChange("change-password-voluntary")} onProfileUpdated={handleProfileUpdate} />;

//             case "change-password-voluntary":
//                 return <ChangePasswordPage onPasswordChangeComplete={() => handleViewChange(appState.role)} userId={appState.userId} userDocId={appState.userDocId} userRole={appState.role} isVoluntary={true} onCancel={() => handleViewChange("profile-management")} />;

//             case "complaintForm":
//             case "complaintList":
//             case "complaintDetail":
//                 const complaintCheck = protectRoute('student');
//                 if (complaintCheck) return complaintCheck;
//                 break;

//             case "feedbackViewer":
//                 const feedbackViewerCheck = protectRoute('warden');
//                 if (feedbackViewerCheck) return feedbackViewerCheck;
//                 return <FeedbackViewer feedbackList={feedbackList} onBack={() => handleViewChange("warden")} onMarkReviewed={handleMarkReviewed} />;

//             case "studentFeedbackList":
//                 const studentFeedbackCheck = protectRoute('student');
//                 if (studentFeedbackCheck) return studentFeedbackCheck;
//                 const studentFeedback = feedbackList.filter((f) => f.userId === appState.userId);
//                 return <FeedbackList feedbackList={studentFeedback} onBack={() => handleViewChange("student")} onDeleteFeedback={handleDeleteFeedback} onEditFeedback={handleEditFeedback} />;

//             case "feedbackForm":
//                 const feedbackFormCheck = protectRoute('student');
//                 if (feedbackFormCheck) return feedbackFormCheck;
//                 return <FeedbackForm onBack={() => handleViewChange("student")} onSubmitFeedback={handleFeedbackSubmit} editingFeedback={editingFeedback} onCancelEdit={handleCancelEdit} currentUser={appState.userData} complaintList={selected} />;

//             default:
//                 // Redirect to appropriate dashboard based on actual role
//                 handleViewChange(appState.role);
//                 return (
//                     <div className="min-h-screen flex items-center justify-center bg-gray-50">
//                         <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mr-3" />
//                         <p className="text-xl text-indigo-700 font-semibold">Redirecting to your dashboard...</p>
//                     </div>
//                 );
//         }

//         // Fallback for complaint routes
//         switch (view) {
//             case "complaintForm":
//                 return <ComplaintForm currentUser={appState.userData} onCreate={handleCreateComplaint} onClose={() => handleViewChange("student")} />;
//             case "complaintList":
//                 return <ComplaintList currentUser={appState.userData} onSelect={c=> { setSelected(c); handleViewChange("complaintDetail"); }} onBack={() => { setSelected(null); handleViewChange(appState.role); }} />;
//             case "complaintDetail":
//                 return <ComplaintDetail complaint={selected} currentUser={appState.userData} onClose={() => { setSelected(null); handleViewChange("complaintList") }} onGiveFeedback={() => handleViewChange("feedbackForm")} />;
//             default:
//                 return null;
//         }
//     };

//     return (
//         <div className="min-h-screen font-sans bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
//             {/* Renders global and local messages, including the persistent login errors */}
//             {isMessageVisible && <MessageBox title={message.title} text={message.text} type={message.type} onClose={closeMessage} />}
//             {renderView()}
//         </div>
//     );
// };

// export default App;

// import React, { useState, useEffect, useCallback, useRef } from "react";
// import { AlertTriangle, Loader2 } from "lucide-react";

// // --- Import UI Component ---
// import MessageBox from './components/MessageBox';

// // --- Import API / Firebase Helpers ---
// import { initializeApp } from "firebase/app";
// import {
//     getAuth, signOut, onAuthStateChanged, signInWithCustomToken, signInAnonymously
// } from 'firebase/auth';
// import {
//     getFirestore, doc, getDoc, collection, query, where, getDocs, setLogLevel,
//     onSnapshot, addDoc, updateDoc, deleteDoc
// } from 'firebase/firestore';

// // Pages / Module Components
// import LoginPage from './pages/LoginPage';
// import PasswordRecoveryPage from './pages/PasswordRecoveryPage';
// import ChangePasswordPage from './pages/ChangePasswordPage';
// import RegisterUserPage from './pages/RegisterUserPage';
// import StudentDashboard from './pages/StudentDashboard';
// import WardenDashboard from './pages/WardenDashboard';
// import StaffDashboard from './pages/StaffDashboard';
// import ProfileManagementPage from './pages/ProfileManagementPage';
// import ComplaintForm from './pages/ComplaintForm';
// import ComplaintList from './pages/ComplaintList';
// import ComplaintDetail from './pages/ComplaintDetail';
// import FeedbackForm from './pages/FeedbackForm';
// import FeedbackViewer from './pages/FeedbackViewer';
// import FeedbackList from './pages/FeedbackList';
// import { wardenSessionCache } from './api/cache';

// // --- Robust Configuration Loading ---
// const appId = typeof __app_id !== 'undefined'
//     ? __app_id
//     : (import.meta.env.VITE_FIREBASE_APP_ID || 'default-app-id');

// const firebaseConfig = typeof __firebase_config !== 'undefined'
//     ? JSON.parse(__firebase_config)
//     : {
//         apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
//         authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
//         projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
//         storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
//         messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
//         appId: import.meta.env.VITE_FIREBASE_APP_ID,
//         measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
//     };

// const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// // --- Initialize Firebase Services ---
// const app = initializeApp(firebaseConfig);
// export const auth = getAuth(app);
// export const db = getFirestore(app);
// setLogLevel('debug');

// // --- Internal Firebase Helper Functions ---
// export const fetchUserRole = async (uid, email) => {
//     try {
//         const userDocRef = doc(db, 'users', uid);
//         let userDoc = await getDoc(userDocRef);

//         if (userDoc.exists()) {
//             const userData = userDoc.data();
//             return {
//                 role: userData.role || 'student',
//                 mustChangePassword: userData.mustChangePassword || false,
//                 userData: userData,
//                 userDocId: uid
//             };
//         }

//         const usersRef = collection(db, 'users');
//         const q = query(usersRef, where('email', '==', email.toLowerCase()));
//         const querySnapshot = await getDocs(q);

//         if (!querySnapshot.empty) {
//             userDoc = querySnapshot.docs[0];
//             const userData = userDoc.data();
//             return {
//                 role: userData.role || 'student',
//                 mustChangePassword: userData.mustChangePassword || false,
//                 userData: userData,
//                 userDocId: userDoc.id
//             };
//         }

//         return {
//             role: 'student',
//             mustChangePassword: true,
//             userData: null,
//             userDocId: uid
//         };

//     } catch (error) {
//         console.error("❌ DEBUG: Error fetching user role:", error);
//         throw new Error("Failed to validate user role against database.");
//     }
// };

// export const getUserFromFirestore = async (uid) => {
//     if (!uid) return null;
//     try {
//         const userDocRef = doc(db, 'users', uid);
//         const userDoc = await getDoc(userDocRef);
//         return userDoc.exists() ? userDoc.data() : null;
//     } catch (error) {
//         console.error("Error fetching user data:", error);
//         return null;
//     }
// };

// // --- Global State Structure ---
// const initialUserState = {
//     userId: null,
//     userDocId: null,
//     role: null,
//     loading: true,
//     error: null,
//     isAuthReady: false,
//     mustChangePassword: false,
//     isAuthenticated: false,
//     forceMandatoryChange: false,
//     userData: null,
// };

// // --- Main App Component (Router & Auth Logic) ---
// const App = () => {
//     const [appState, setAppState] = useState(initialUserState);
//     const [isRegistering, setIsRegistering] = useState(false);
//     const [lastWardenHash, setLastWardenHash] = useState(null);
//     const [isLoginCheckFailed, setIsLoginCheckFailed] = useState(false);
//     const [isMessageVisible, setIsMessageVisible] = useState(false);
//     const [message, setMessage] = useState({ title: "", text: "", type: "" });
//     const [isManualLogout, setIsManualLogout] = useState(false);
    
//     // 🔑 CRITICAL FIX: Use ref for immediate registration lock
//     const isRegisteringRef = useRef(false);
    
//     // complaint
//     const [complaints, setComplaints] = useState([]);
//     const [selected, setSelected] = useState(null);

//     // feedback
//     const [feedbackList, setFeedbackList] = useState([]);
//     const [editingFeedback, setEditingFeedback] = useState(null);

//     const closeMessage = () => setIsMessageVisible(false);

//     // Helper to determine initial view from URL hash
//     const getInitialView = useCallback(() => {
//         const hash = window.location.hash.replace(/^#\/?/, '');
//         const publicViews = ['password-recovery', 'login', 'change-password'];

//         if (publicViews.includes(hash)) {
//             return hash;
//         }

//         // Allow all authenticated subpages to stay
//         const allowedAuthViews = [
//             'warden', 'student', 'staff', 
//             'register-user',
//             'profile-management',
//             'change-password-voluntary',
//             'complaintList',
//             'complaintDetail',
//             'complaintForm',
//             'feedbackViewer',
//             'studentFeedbackList',
//             'feedbackForm'
//         ];

//         if (allowedAuthViews.includes(hash)) {
//             return hash;
//         }

//         // Default to login if truly invalid
//         return 'login';
//     }, []);

//     const [view, setView] = useState(getInitialView());

//     // Handles view changes and updates URL hash
//     const handleViewChange = useCallback((newView) => {
//         setView(prevView => {
//             if (prevView !== newView) {
//                 window.location.hash = `/${newView}`;
//                 if (newView === 'register-user' && appState.role === 'warden') {
//                     setLastWardenHash('register-user');
//                 }
//                 return newView;
//             }
//             return prevView;
//         });
//     }, [appState.role]);

//     // 🔑 ENHANCED: Registration Handlers with IMMEDIATE Lock
//     const handleRegistrationStart = () => {
//         console.log("🔒 DEBUG: Starting registration - setting immediate lock");
//         console.log("🔒 DEBUG: This prevents Enter key race condition");
//         // Set BOTH state and ref for immediate and consistent locking
//         isRegisteringRef.current = true;
//         setIsRegistering(true);
//     };

//     const handleRegistrationComplete = (status = null, registrationData = null) => {
//         console.log("🔒 DEBUG: Registration complete - releasing lock");
//         // Release BOTH state and ref
//         isRegisteringRef.current = false;
//         setIsRegistering(false);

//         if (status === 'success') {
//             setMessage({
//                 title: "Account Created! 🎉",
//                 text: `A new ${registrationData.role} account for ${registrationData.name} (${registrationData.uniqueId}) has been created successfully. Temporary Password: ${registrationData.tempPassword}. The user will be forced to change this password upon first login.`,
//                 type: "success"
//             });
//             setIsMessageVisible(true);
            
//             setTimeout(() => {
//                 setIsMessageVisible(false);
//             }, 5000);
            
//             // CRITICAL: Explicitly keep warden on register page
//             handleViewChange('register-user');

//         } else if (status === 'error') {
//             setLastWardenHash(null);
//             console.log("Registration failed - lock released.");
//         } else {
//             setLastWardenHash(null);
//         }
//     };

//     // Sync state with URL hash
//     useEffect(() => {
//         const handleHashChange = () => {
//             const newHash = window.location.hash.replace(/^#\/?/, '');
//             if (newHash && newHash !== view && appState.isAuthReady) {
//                 setView(newHash);
//             }
//         };

//         window.addEventListener('hashchange', handleHashChange);
//         return () => window.removeEventListener('hashchange', handleHashChange);
//     }, [view, appState.isAuthReady]);

//     // 🔑 CRITICAL FIX: Enhanced Auth State Listener with Ref-based Lock
//     useEffect(() => {
//         let isInitialLoad = true;
//         const unsubscribe = onAuthStateChanged(auth, async (user) => {

//             if (isManualLogout) {
//                 console.log("🔒 DEBUG: Manual logout in progress - ignoring auth state change");
//                 return;
//             }

//             // 🔑 CRITICAL FIX: Use ref for immediate check (state updates are async)
//             if (isRegisteringRef.current) {
//                 console.log("🔒 DEBUG: REGISTRATION LOCK ACTIVE - ignoring ALL auth changes");
//                 console.log("🔒 DEBUG: This prevents Enter key race condition");
//                 return;
//             }

//             // Also check state for consistency
//             if (isRegistering) {
//                 console.log("🔒 DEBUG: Registration state lock active");
//                 return;
//             }

//             if (isLoginCheckFailed) {
//                 console.log("🔒 DEBUG: Login check failed - ignoring auth state change");
//                 setIsLoginCheckFailed(false); 
//                 return;
//             }

//             if (user) {
//                 try {
//                     const userData = await fetchUserRole(user.uid, user.email);

//                     if (!userData || !userData.role) {
//                         throw new Error("User document or role data is missing or corrupted.");
//                     }

//                     setAppState(prev => ({
//                         ...prev,
//                         userId: user.uid,
//                         userDocId: userData.userDocId,
//                         role: userData.role,
//                         isAuthenticated: true,
//                         isAuthReady: true,
//                         loading: false,
//                         mustChangePassword: userData.mustChangePassword,
//                         forceMandatoryChange: userData.mustChangePassword,
//                         userData: userData.userData,
//                         error: null
//                     }));

//                     const currentHash = window.location.hash.replace(/^#\/?/, '');
//                     console.log("🔧 DEBUG: Auth state change - Current hash:", currentHash, "Role:", userData.role);

//                     // 🔑 ENHANCED: More aggressive register page protection
//                     if (currentHash === 'register-user') {
//                         console.log("🔧 DEBUG: USER IS ON REGISTER PAGE - BLOCKING ALL NAVIGATION");
                        
//                         // If warden, definitely stay on register page
//                         if (userData.role === 'warden') {
//                             console.log("🔧 DEBUG: Warden confirmed on register page - NO NAVIGATION");
//                             return;
//                         }
                        
//                         // If non-warden somehow on register page, redirect them out
//                         console.log("🔧 DEBUG: Non-warden on register page - redirecting to dashboard");
//                         handleViewChange(userData.role);
//                         return;
//                     }

//                     // Warden register page priority (secondary protection)
//                     if (userData.role === 'warden' && lastWardenHash === 'register-user') {
//                         console.log("🔧 DEBUG: Warden returning to register page from cache");
//                         handleViewChange('register-user');
//                         return;
//                     }

//                     // Handle mandatory password changes for students
//                     if (userData.mustChangePassword && userData.role === 'student') {
//                         handleViewChange('change-password');
//                         return;
//                     }

//                     // Only redirect away from public pages
//                     if (currentHash === 'login' || currentHash === 'password-recovery') {
//                         handleViewChange(userData.role);
//                         return;
//                     }

//                     // If no specific routing needed and no current hash, go to role-based dashboard
//                     if (!currentHash || currentHash === '') {
//                         handleViewChange(userData.role);
//                     }

//                 } catch (error) {
//                     console.error("❌ CRITICAL AUTH/ROLE CHECK ERROR:", error);
//                     await signOut(auth);
//                     setAppState(prev => ({
//                         ...initialUserState,
//                         loading: false,
//                         isAuthReady: true,
//                         error: "Failed to load user data. Please log in again."
//                     }));
//                     handleViewChange('login');
//                 }
//             } else {
//                 // User is signed out
//                 setAppState({
//                     ...initialUserState,
//                     loading: false,
//                     isAuthReady: true
//                 });
//                 setLastWardenHash(null);
//                 handleViewChange("login");
//             }

//             isInitialLoad = false;
//         });

//         return () => unsubscribe();
//     }, [isRegistering, lastWardenHash, isLoginCheckFailed, isManualLogout]);

//     // 🔑 NEW: Sync ref with state to keep them consistent
//     useEffect(() => {
//         isRegisteringRef.current = isRegistering;
//         console.log("🔄 DEBUG: Registration ref synced with state:", isRegistering);
//     }, [isRegistering]);

//     // feedback fetching
//     useEffect(() => {
//         if (!appState.isAuthReady) {
//             console.log("Waiting for auth before fetching feedback...");
//             return;
//         }

//         let unsubscribe = () => { };

//         const fetchFeedbacks = async () => {
//             try {
//                 const feedbackCollectionPath = "feedbacks";
//                 const q = query(collection(db, feedbackCollectionPath));

//                 unsubscribe = onSnapshot(q, (snapshot) => {
//                     const data = snapshot.docs.map((doc) => ({
//                         id: doc.id,
//                         ...doc.data(),
//                     }));
//                     setFeedbackList(data);
//                 }, (error) => {
//                     console.error("Error fetching feedbacks (onSnapshot): ", error);
//                 });
//             } catch (error) {
//                 console.error("Error setting up feedback listener: ", error);
//             }
//         };

//         fetchFeedbacks();

//         return () => {
//             console.log("Cleaning up feedback listener.");
//             unsubscribe();
//         };
//     }, [appState.isAuthReady]);

//     const handleProfileUpdate = (updatedUserDataFromChild) => {
//         console.log("APP_STATE: Profile data is being updated globally.", updatedUserDataFromChild);
//         setAppState(prev => ({
//             ...prev,
//             userData: updatedUserDataFromChild
//         }));
//     };

//     const handleLoginSuccess = () => {
//         console.log("Login success signal received from LoginPage. Waiting for auth listener...");
//     };
    
//     const handleForcedPasswordChangeComplete = async () => {
//         try {
//             if (!appState.userDocId) {
//                 throw new Error("No user document ID found in state. Cannot update password flag.");
//             }
            
//             // 1. Get the reference to the user's document
//             const userDocRef = doc(db, 'users', appState.userDocId);
            
//             // 2. Update the database field to 'false'
//             await updateDoc(userDocRef, {
//                 mustChangePassword: false
//             });

//             // 3. If database update succeeds, update the local React state
//             setAppState(prev => ({
//                 ...prev,
//                 mustChangePassword: false,
//                 forceMandatoryChange: false
//             }));

//             // 4. Finally, send the user to their dashboard
//             handleViewChange(appState.role);
            
//         } catch (error) {
//             // If the database write fails, show an error and keep them on the page
//             console.error("CRITICAL: Failed to update mustChangePassword flag in database:", error);
//             setMessage({
//                 title: "Update Failed",
//                 text: "Your password was changed, but we failed to save the update. Please try again or contact support.",
//                 type: "error"
//             });
//             setIsMessageVisible(true);
//         }
//     };

//     const handleLogout = async () => {
//         try {
//             setIsManualLogout(true);
//             setLastWardenHash(null);
            
//             // Clear the cached warden credentials on manual logout
//             wardenSessionCache.email = null;
//             wardenSessionCache.password = null;

//             console.log("🚪 Starting manual logout...");
//             await signOut(auth);
//             console.log("✅ Manual logout completed");
            
//             handleViewChange("login");
            
//             // Reset after successful logout
//             setTimeout(() => {
//                 setIsManualLogout(false);
//                 console.log("🔄 Manual logout flag reset");
//             }, 1000);
            
//         } catch (error) {
//             console.error("Logout error:", error);
            
//             // Also clear cache on error, just in case
//             wardenSessionCache.email = null;
//             wardenSessionCache.password = null;
            
//             setIsManualLogout(false);
//         }
//     };
    
//     const handleForgotPasswordClick = () => {
//         handleViewChange("password-recovery");
//     };

//     const handleBackToLogin = () => {
//         handleViewChange("login");
//     };

//     // Complaint handlers
//     const handleCreateComplaint = (complaint) => {
//         setComplaints((prev) => [complaint, ...prev]);
//     };

//     // Feedback handlers
//     const handleFeedbackSubmit = async (feedback) => {
//         try {
//             if (editingFeedback) {
//                 // Update existing feedback
//                 const feedbackRef = doc(db, "feedbacks", feedback.id.toString());
//                 await updateDoc(feedbackRef, feedback);
//             } else {
//                 // Add new feedback
//                 const docRef = await addDoc(collection(db, "feedbacks"), feedback);
//             }
//             setEditingFeedback(null);
//             setView("studentFeedbackList");
//         } catch (error) {
//             console.error("Error adding feedback: ", error);
//         }
//     };

//     const handleDeleteFeedback = async (id) => {
//         try {
//             await deleteDoc(doc(db, "feedbacks", id.toString()));
//             setFeedbackList((prev) => prev.filter((f) => f.id !== id));
//         } catch (error) {
//             console.error("Error deleting feedback: ", error);
//         }
//     };

//     const handleEditFeedback = (feedback) => {
//         setEditingFeedback(feedback);
//         setView("feedbackForm");
//     };

//     const handleCancelEdit = () => {
//         setEditingFeedback(null);
//         setView("studentFeedbackList");
//     };

//     const handleMarkReviewed = async (id) => {
//         try {
//             const feedbackCollectionPath = "feedbacks";
//             const feedbackRef = doc(db, feedbackCollectionPath, id);
//             await updateDoc(feedbackRef, { reviewed: true });
//         } catch (error) {
//             console.error("Error marking feedback as reviewed: ", error);
//         }
//     };

//     const renderView = () => {
//         // Show loading screen during registration
//         if (appState.loading || !appState.isAuthReady || isRegistering) {
//             return (
//                 <div className="min-h-screen flex items-center justify-center bg-gray-50">
//                     <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mr-3" />
//                     <p className="text-xl text-indigo-700 font-semibold">
//                         {isRegistering ? "Creating account and restoring session..." : "Connecting to HostelFix..."}
//                     </p>
//                 </div>
//             );
//         }

//         if (appState.error) {
//             return (
//                 <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 p-4">
//                     <AlertTriangle className="w-12 h-12 text-red-600 mb-4" />
//                     <h2 className="text-2xl font-bold text-red-800 mb-2">System Error</h2>
//                     <p className="text-red-700">{appState.error}</p>
//                     <button 
//                         onClick={handleBackToLogin} 
//                         className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition duration-150"
//                     >
//                         Back to Login
//                     </button>
//                 </div>
//             );
//         }

//         if (!appState.isAuthenticated) {
//             switch (view) {
//                 case "password-recovery":
//                     return <PasswordRecoveryPage onBackToLogin={handleBackToLogin} />;
//                 case "login":
//                 default:
//                     return (
//                         <LoginPage
//                             onLoginSuccess={handleLoginSuccess}
//                             onForgotPassword={handleForgotPasswordClick}
//                             onLoginFailure={setIsLoginCheckFailed}
//                         />
//                     );
//             }
//         }

//         // Mandatory Password Change Gate (Forces student users)
//         if (appState.forceMandatoryChange && appState.role === "student") {
//             if (view !== "change-password") {
//                 handleViewChange("change-password");
//             }
//             return (
//                 <ChangePasswordPage
//                     onPasswordChangeComplete={handleForcedPasswordChangeComplete}
//                     userId={appState.userId}
//                     userDocId={appState.userDocId}
//                     userRole={appState.role}
//                     isVoluntary={false}
//                     onCancel={null}
//                 />
//             );
//         }

//         switch (view) {
//             case "student":
//                 return (
//                     <StudentDashboard
//                         onLogout={handleLogout}
//                         name={appState.userData?.name || ""}
//                         hostelId={appState.userData?.hostelId || ""}
//                         userRole={appState.role}
//                         onViewChange={handleViewChange}
//                     />
//                 );

//             case "warden":
//                 return (
//                     <WardenDashboard
//                         onLogout={handleLogout}
//                         userId={appState.userId}
//                         userDocId={appState.userDocId}
//                         userRole={appState.role}
//                         onViewChange={handleViewChange}
//                     />
//                 );
            
//             case "staff":
//                 return (
//                     <StaffDashboard
//                         onLogout={handleLogout}
//                         name={appState.userData?.name || ""}
//                         staffWardenId={appState.userData?.staffWardenId || ""} 
//                         userRole={appState.role}
//                         onViewChange={handleViewChange}
//                     />
//                 );
                
//             case "register-user":
//                 // ENHANCED: Explicit register-user view handling for warden
//                 if (appState.role === "warden") {
//                     console.log("🎯 DEBUG: Rendering RegisterUserPage for warden");
//                     return (
//                         <RegisterUserPage
//                             onBackToDashboard={() => handleViewChange("warden")}
//                             onRegistrationStart={handleRegistrationStart}
//                             onRegistrationComplete={handleRegistrationComplete}
//                         />
//                     );
//                 }

//                 // 🔑 FIX: Simple error message without useEffect redirect
//                 return (
//                     <MessageBox
//                         title="Unauthorized Access"
//                         text="Only wardens are allowed to register new users."
//                         type="error"
//                         onClose={() => handleViewChange(appState.role)}
//                     />
//                 );

//             case "profile-management":
//                 if (!appState.userData) {
//                     return (
//                         <div className="min-h-screen flex items-center justify-center bg-gray-50">
//                             <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mr-3" />
//                             <p className="text-xl text-indigo-700 font-semibold">Loading Profile...</p>
//                         </div>
//                     );
//                 }
//                 return (
//                     <ProfileManagementPage
//                         appState={appState}
//                         onBackToDashboard={() => handleViewChange(appState.role)}
//                         onPasswordChange={() => handleViewChange("change-password-voluntary")}
//                         onProfileUpdated={handleProfileUpdate}
//                     />
//                 );

//             case "change-password-voluntary":
//                 return (
//                     <ChangePasswordPage
//                         onPasswordChangeComplete={() => handleViewChange(appState.role)}
//                         userId={appState.userId}
//                         userDocId={appState.userDocId}
//                         userRole={appState.role}
//                         isVoluntary={true}
//                         onCancel={() => handleViewChange("profile-management")}
//                     />
//                 );

//             case "complaintForm":
//                 return (
//                     <ComplaintForm
//                         currentUser={appState.userData}
//                         onCreate={handleCreateComplaint}
//                         onClose={() => handleViewChange("student")}
//                     />
//                 );

//             case "complaintList":
//                 return <ComplaintList 
//                             currentUser={appState.userData}
//                             onSelect={c=> { setSelected(c); handleViewChange("complaintDetail"); }}
//                             onBack={() => { setSelected(null); handleViewChange(appState.role); }}
//                         />;
                    
//             case "complaintDetail":
//                 return <ComplaintDetail
//                             complaint={selected}
//                             currentUser={appState.userData}
//                             onClose={() => { setSelected(null); handleViewChange("complaintList") }}
//                             onGiveFeedback={() => handleViewChange("feedbackForm")}
//                         />;
            
//             case "feedbackForm":
//                 return (
//                     <FeedbackForm
//                         onBack={() => handleViewChange("student")}
//                         onSubmitFeedback={handleFeedbackSubmit}
//                         editingFeedback={editingFeedback}
//                         onCancelEdit={handleCancelEdit}
//                         currentUser={appState.userData}
//                         complaintList={selected}
//                     />
//                 );

//             case "feedbackViewer":
//                 return (
//                     <FeedbackViewer
//                         feedbackList={feedbackList}
//                         onBack={() => handleViewChange("warden")}
//                         onMarkReviewed={handleMarkReviewed}
//                     />
//                 );

//             case "studentFeedbackList":
//                 const studentFeedback = feedbackList.filter(
//                     (f) => f.userId === appState.userId
//                 );
//                 return (
//                     <FeedbackList
//                         feedbackList={studentFeedback}
//                         onBack={() => handleViewChange("student")}
//                         onDeleteFeedback={handleDeleteFeedback}
//                         onEditFeedback={handleEditFeedback}
//                     />
//                 );

//             default:
//                 if (appState.role === "warden") {
//                     return (
//                         <WardenDashboard
//                             onLogout={handleLogout}
//                             userId={appState.userId}
//                             userDocId={appState.userDocId}
//                             userRole={appState.role}
//                             onViewChange={handleViewChange}
//                         />
//                     );
//                 }
                
//                 if (appState.role === "staff") { 
//                     return (
//                         <StaffDashboard
//                             onLogout={handleLogout}
//                             name={appState.userData?.name || ""}
//                             staffWardenId={appState.userData?.staffWardenId || ""} 
//                             userRole={appState.role}
//                             onViewChange={handleViewChange}
//                         />
//                     );
//                 }
                
//                 if (appState.role === "student") {
//                     return (
//                         <StudentDashboard
//                             onLogout={handleLogout}
//                             userId={appState.userId}
//                             userDocId={appState.userDocId}
//                             userRole={appState.role}
//                             onViewChange={handleViewChange}
//                         />
//                     );
//                 }
//                 return (
//                     <div className="min-h-screen flex items-center justify-center bg-gray-50">
//                         <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mr-3" />
//                         <p className="text-xl text-indigo-700 font-semibold">
//                             Finalizing session...
//                         </p>
//                     </div>
//                 );
//         }
//     };

//     return (
//         <div className="min-h-screen font-sans bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
//             {isMessageVisible && (
//                 <MessageBox title={message.title} text={message.text} type={message.type} onClose={closeMessage} />
//             )}
//             {renderView()}
//         </div>
//     );
// };

// export default App;
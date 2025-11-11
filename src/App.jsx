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
                return <ComplaintForm currentUser={appState.userData} onCreate={handleCreateComplaint} onClose={() => handleViewChange("student")} />;
            
            case "complaintList":
                return <ComplaintList currentUser={appState.userData} onSelect={c=> { setSelected(c); handleViewChange("complaintDetail"); }} onBack={() => { setSelected(null); handleViewChange(appState.role); }} />;
            
            case "complaintDetail":
                return <ComplaintDetail complaint={selected} currentUser={appState.userData} onClose={() => { setSelected(null); handleViewChange("complaintList") }} onGiveFeedback={() => handleViewChange("feedbackForm")} />;

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

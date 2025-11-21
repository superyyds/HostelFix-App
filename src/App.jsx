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

<<<<<<< HEAD
// Reusable Info Row Component
const InfoRow = ({ label, value }) => (
  <div className="flex justify-between">
    <span className="font-medium">{label}:</span>
    <span className="text-gray-800">{value}</span>
  </div>
);

// --- Core Application Views ---

const LoginPage = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleType, setRoleType] = useState("student"); // Added role selection state
  const [isMessageVisible, setIsMessageVisible] = useState(false);
  const [message, setMessage] = useState({ title: "", text: "", type: "" });

  // Simple role-based login simulation
  const handleLogin = (e) => {
    e.preventDefault();

    // Basic validation check
    if (!email || !password) {
      setMessage({
        title: "Login Failed",
        text: "Please enter both Email and Password.",
        type: "error",
      });
      setIsMessageVisible(true);
      return;
    }

    // Simulate successful login
    setMessage({
      title: "Login Successful",
      text: `Welcome! Logged in as: ${roleType.toUpperCase()}. Redirecting...`,
      type: "success",
    });
    setIsMessageVisible(true);
    setTimeout(() => {
      setIsMessageVisible(false);
      onLoginSuccess(roleType);
    }, 1500); // Wait for message, then navigate
  };

  const closeMessage = () => setIsMessageVisible(false);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      
      {/* Dynamic Message Box */}
      {isMessageVisible && (
        <MessageBox 
            title={message.title} 
            text={message.text} 
            type={message.type} 
            onClose={closeMessage} 
        />
      )}

      {/* Login Card - Higher Class Design */}
      <div className="w-full max-w-md bg-white p-8 md:p-10 rounded-xl shadow-2xl transition duration-500 transform hover:shadow-3xl">
        
        {/* Header */}
        <div className="flex items-center justify-center mb-2">
            <Briefcase className="w-10 h-10 text-indigo-600 mr-3" />
            <h1 className="text-4xl font-extrabold text-gray-800 tracking-tight">HostelFix</h1>
        </div>
        <p className="text-center text-gray-500 mb-8 text-lg font-light">
            Sign in to manage facility issues.
        </p>
        
        {/* Role Selection Toggle */}
        <RoleToggle role={roleType} setRole={setRoleType} />

        {/* Form */}
        <form onSubmit={handleLogin}>
          <InputField
            icon={Mail} // Changed to Mail icon for email
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <InputField
            icon={LogIn}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <div className="mt-8">
            <PrimaryButton type="submit" className="w-full">
              Sign In
            </PrimaryButton>
          </div>
        </form>
        
        {/* Footer Links (Optional but professional) */}
        <div className="mt-6 text-center text-sm">
          <a href="#" className="text-indigo-600 hover:text-indigo-800 transition duration-150">
            Forgot Password?
          </a>
          <span className="mx-2 text-gray-400">|</span>
          <a href="#" className="text-indigo-600 hover:text-indigo-800 transition duration-150">
            Register Student Account
          </a>
        </div>
      </div>
    </div>
  );
};

// ---------------- Feedback Module ----------------
export const FeedbackForm = ({ onBack, onSubmitFeedback, editingFeedback, onCancelEdit }) => {
  const [feedbackText, setFeedbackText] = useState(editingFeedback?.feedbackText || "");
  const [ratings, setRatings] = useState(
    editingFeedback?.ratings || {
      responseTime: 0,
      serviceQuality: 0,
      communication: 0,
    }
  );
  const [image, setImage] = useState(editingFeedback?.image || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [messageBox, setMessageBox] = useState({ visible: false, type: "", text: "" });

  useEffect(() => {
    if (editingFeedback) {
      setFeedbackText(editingFeedback.feedbackText || "");
      setRatings(editingFeedback.ratings || {
        responseTime: 0,
        serviceQuality: 0,
        communication: 0,
      });
      setImage(editingFeedback.image || null);
    }
  }, [editingFeedback]);

  const handleRating = (aspect, value) => {
    setRatings((prev) => ({ ...prev, [aspect]: value }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
      const maxSize = 1 * 1024 * 1024; // 1MB
      if (!allowedTypes.includes(file.type)) {
        setMessageBox({ visible: true, type: "error", text: "Only JPG and PNG images are allowed." });
        e.target.value = "";
        return;
      }
      if (file.size > maxSize) {
        setMessageBox({ visible: true, type: "error", text: "Image size must be under 1MB." });
        e.target.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setImage(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const validateForm = () => {
    const hasMissingRatings = Object.values(ratings).some((r) => r === 0);
    if (hasMissingRatings) {
      setMessageBox({ visible: true, type: "error", text: "Please rate all categories before submitting." });
      return false;
    }
    if (feedbackText.trim().length < 10) {
      setMessageBox({ visible: true, type: "error", text: "Feedback must be at least 10 characters long." });
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // --- VALIDATION SECTION ---
    if (!feedbackText.trim() || Object.values(ratings).some((r) => r === 0)) {
      setMessageBox({
        visible: true,
        type: "error",
        text: "Please rate all aspects and provide your feedback before submitting.",
      });
      return;
    }

    if (feedbackText.trim().length < 10) {
      setMessageBox({
        visible: true,
        type: "error",
        text: "Feedback must be at least 10 characters long.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const avg =
        Object.values(ratings).reduce((a, b) => a + b, 0) / Object.keys(ratings).length;

      const feedback = {
        ...(editingFeedback || {}),
        feedbackText,
        ratings,
        averageRating: parseFloat(avg.toFixed(1)),
        image,
        createdAt: editingFeedback?.createdAt || new Date().toLocaleString(),
        reviewed: editingFeedback?.reviewed || false,
      };

      // Save or update Firestore through your callback
      await onSubmitFeedback(feedback);

      // Show success message
      setMessageBox({
        visible: true,
        type: "success",
        text: editingFeedback
          ? "Your feedback has been updated successfully."
          : "Thank you! Your feedback has been submitted successfully.",
      });

      setTimeout(() => {
        setIsSubmitting(false);
      }, 1200);

      // Reset form
      setFeedbackText("");
      setRatings({ responseTime: 0, serviceQuality: 0, communication: 0 });
      setImage(null);
    } catch (error) {
      console.error("Feedback submission failed:", error);
      setMessageBox({
        visible: true,
        type: "error",
        text: "An error occurred while submitting feedback. Please try again later.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-3xl bg-white/90 backdrop-blur-md p-8 rounded-2xl shadow-xl border border-indigo-100"
      >
        <h2 className="text-3xl font-bold text-indigo-700 mb-8 text-center">
          {editingFeedback ? "Edit Your Feedback" : "Submit Your Feedback"}
        </h2>

        <form onSubmit={handleSubmit}>
          {Object.keys(ratings).map((aspect) => (
            <div key={aspect} className="mb-6">
              <label className="block text-lg font-semibold text-gray-700 mb-2 capitalize">
                {aspect.replace(/([A-Z])/g, " $1")}
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((num) => (
                  <Star
                    key={num}
                    onClick={() => handleRating(aspect, num)}
                    className={`w-7 h-7 cursor-pointer transition-transform ${
                      num <= ratings[aspect]
                        ? "text-yellow-400 fill-yellow-400 scale-110"
                        : "text-gray-300 hover:text-yellow-300"
                    }`}
                  />
                ))}
              </div>
            </div>
          ))}

          <textarea
            className="w-full border border-gray-200 rounded-xl p-4 h-32 focus:ring-2 focus:ring-indigo-500 mb-6 resize-none text-gray-700 shadow-sm"
            placeholder="Share your feedback here..."
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
          ></textarea>

          <div className="mb-6">
            <label className="block text-sm font-semibold mb-2 text-gray-700">
              Optional Image Attachment
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="border border-gray-300 rounded-md p-2 w-full"
            />
            {image && (
              <img
                src={image}
                alt="Preview"
                className="mt-3 w-40 h-40 object-cover rounded-lg border border-gray-200 shadow"
              />
            )}
          </div>

          <div className="flex justify-center space-x-4 mt-8">
            <PrimaryButton 
              type="submit" 
              className="bg-indigo-600 hover:bg-indigo-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader className="w-5 h-5 mr-2 inline animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5 mr-2 inline" />
                  {editingFeedback ? "Update Feedback" : "Submit Feedback"}
                </>
              )}
            </PrimaryButton>

            <PrimaryButton
              onClick={editingFeedback ? onCancelEdit : onBack}
              className="bg-gray-400 hover:bg-gray-500"
              type="button"
            >
              <ArrowLeft className="w-5 h-5 mr-2 inline" />
              {editingFeedback ? "Cancel Edit" : "Back"}
            </PrimaryButton>
          </div>
        </form>
        {messageBox.visible && (
          <div
            className={`fixed top-5 right-5 z-50 flex items-center gap-3 p-4 rounded-lg shadow-lg transition-all ${
              messageBox.type === "success" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            }`}
          >
            {messageBox.type === "success" ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
            <span className="font-medium">{messageBox.text}</span>
            <button
              onClick={() => setMessageBox({ ...messageBox, visible: false })}
              className="ml-3 text-sm underline hover:opacity-80"
            >
              Close
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

// --- Feedback List ---
export const FeedbackList = ({ feedbackList, onBack, onDeleteFeedback, onEditFeedback }) => {
  const [filterRating, setFilterRating] = useState("all");
  const clearFilter = () => setFilterRating("all");

  const filtered =
    filterRating === "all"
      ? feedbackList
      : feedbackList.filter((f) => Math.floor(f.averageRating) >= parseInt(filterRating));

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 p-10">
      <div className="max-w-5xl mx-auto bg-white/95 backdrop-blur-md p-10 rounded-2xl shadow-lg border border-gray-100">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-indigo-700">My Feedback</h2>
          <PrimaryButton onClick={onBack} className="bg-gray-400 hover:bg-gray-500">
            Back
          </PrimaryButton>
        </div>

        <div className="flex justify-end items-center gap-3 mb-5">
          <select
            className="border border-gray-300 rounded-lg px-3 py-2 text-gray-700 bg-gray-50 shadow-sm"
            value={filterRating}
            onChange={(e) => setFilterRating(e.target.value)}
          >
            <option value="all">All Ratings</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}+ Stars
              </option>
            ))}
          </select>
          {filterRating !== "all" && (
            <button
              onClick={clearFilter}
              className="text-sm text-red-500 hover:underline font-medium"
            >
              Clear Filter
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <p className="text-gray-500 text-center mt-8">No feedback available.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {filtered.map((fb) => (
              <motion.div
                key={fb.id}
                whileHover={{ scale: 1.02 }}
                className="border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all bg-white"
              >
                <div className="flex justify-between mb-2 items-center">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-5 h-5 ${
                          i < Math.round(fb.averageRating)
                            ? "text-yellow-400 fill-yellow-400"
                            : "text-gray-300"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-gray-400 text-sm">{fb.createdAt}</p>
                </div>

                <p className="text-gray-700 mb-3 leading-relaxed">{fb.feedbackText}</p>
                {fb.image && (
                  <img
                    src={fb.image}
                    alt="Feedback attachment"
                    className="w-32 h-32 object-cover rounded-lg mb-3 shadow-sm"
                  />
                )}

                <div className="flex space-x-4 text-sm font-medium">
                  <button
                    onClick={() => onEditFeedback(fb)}
                    className="text-blue-500 hover:text-blue-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDeleteFeedback(fb.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// --- Feedback Viewer (Enhanced Analytics) ---
export const FeedbackViewer = ({ feedbackList, onBack, onMarkReviewed }) => {
  // --- Compute Rating Distribution Data ---
  const data = [1, 2, 3, 4, 5].map((r) => ({
    rating: r,
    count: feedbackList.filter((f) => Math.round(f.averageRating) === r).length,
  }));

  // --- Compute Average Overall Rating ---
  const avgRating =
    feedbackList.length > 0
      ? feedbackList.reduce((sum, f) => sum + (f.averageRating || 0), 0) / feedbackList.length
      : 0;

  // --- Compute Average by Category (Response, Service, Communication) ---
  const categoryData = [
    {
      aspect: "Response Time",
      avg:
        feedbackList.length > 0
          ? feedbackList.reduce((sum, f) => sum + (f.ratings?.responseTime || 0), 0) /
            feedbackList.length
          : 0,
    },
    {
      aspect: "Service Quality",
      avg:
        feedbackList.length > 0
          ? feedbackList.reduce((sum, f) => sum + (f.ratings?.serviceQuality || 0), 0) /
            feedbackList.length
          : 0,
    },
    {
      aspect: "Communication",
      avg:
        feedbackList.length > 0
          ? feedbackList.reduce((sum, f) => sum + (f.ratings?.communication || 0), 0) /
            feedbackList.length
          : 0,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-sky-100 p-10">
      <div className="max-w-6xl mx-auto bg-white/95 backdrop-blur-md p-10 rounded-2xl shadow-lg border border-gray-100">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold text-indigo-700">Feedback Analytics</h2>
          <PrimaryButton onClick={onBack} className="bg-gray-400 hover:bg-gray-500">
            Back
          </PrimaryButton>
        </div>

        {/* --- Summary Section --- */}
        <div className="grid md:grid-cols-3 gap-6 mb-10 text-center">
          <div className="bg-indigo-50 p-6 rounded-xl shadow-sm">
            <p className="text-gray-500 text-sm">Total Feedbacks</p>
            <h3 className="text-3xl font-bold text-indigo-700">{feedbackList.length}</h3>
          </div>
          <div className="bg-indigo-50 p-6 rounded-xl shadow-sm">
            <p className="text-gray-500 text-sm">Average Satisfaction</p>
            <h3 className="text-3xl font-bold text-green-600">
              {avgRating.toFixed(1)} / 5
            </h3>
          </div>
          <div className="bg-indigo-50 p-6 rounded-xl shadow-sm">
            <p className="text-gray-500 text-sm">Last Updated</p>
            <h3 className="text-lg font-semibold text-gray-700">
              {new Date().toLocaleDateString()}
            </h3>
          </div>
        </div>

        {/* --- Rating Distribution Chart --- */}
        <div className="bg-gradient-to-r from-indigo-100 to-indigo-200 p-4 rounded-xl shadow-inner mb-10">
          <h3 className="text-xl font-semibold text-indigo-800 mb-3">
            Rating Distribution
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="rating" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#4F46E5" radius={[6, 6, 0, 0]} name="Feedback Count" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* --- Aspect Comparison Chart --- */}
        <div className="bg-gradient-to-r from-indigo-100 to-sky-200 p-4 rounded-xl shadow-inner mb-10">
          <h3 className="text-xl font-semibold text-indigo-800 mb-3">
            Average Ratings by Aspect
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={categoryData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="aspect" />
              <YAxis domain={[0, 5]} />
              <Tooltip />
              <Legend />
              <Bar dataKey="avg" fill="#22C55E" radius={[6, 6, 0, 0]} name="Average Rating" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* --- Feedback List Section --- */}
        <h3 className="text-2xl font-semibold text-indigo-700 mb-4">Recent Feedback</h3>
        <div className="space-y-4">
          {feedbackList.map((fb) => (
            <motion.div
              key={fb.id}
              whileHover={{ scale: 1.01 }}
              className="border border-gray-200 p-5 rounded-xl flex justify-between items-center shadow-sm hover:shadow-md bg-white"
            >
              <div>
                <p className="text-gray-800 font-medium">{fb.feedbackText}</p>
                <p className="text-gray-500 text-sm">
                  Avg: {fb.averageRating?.toFixed(1)} / 5 • {fb.createdAt}
                </p>
              </div>
              {!fb.reviewed && (
                <PrimaryButton
                  onClick={() => onMarkReviewed(fb.id)}
                  className="bg-green-500 hover:bg-green-600"
                >
                  Mark Reviewed
                </PrimaryButton>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Dashboard Card Component for high-quality visuals
const DashboardCard = ({ icon: Icon, title, description, color, onClick = () => {} }) => (
    <button 
        onClick={onClick}
        className="w-full text-left bg-white p-6 rounded-xl shadow-lg transition duration-300 ease-in-out transform hover:scale-[1.02] hover:shadow-xl border-t-4 border-indigo-500"
    >
        <Icon className={`w-8 h-8 mb-4 ${color}`} />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600">{description}</p>
    </button>
);

// ---- Complaint Management module ----

const STATUS = { PENDING: 'Pending', IN_PROGRESS: 'In Progress', RESOLVED: 'Resolved' };

// Simple in-memory "id" generator
const makeId = () => Date.now().toString(36) + Math.random().toString(36).slice(2,8);

// Complaint Form component (common)
const ComplaintForm = ({ currentUser, onCreate, onClose }) => {
  const [step, setStep] = useState(1);
  const [campus, setCampus] = useState("");
  const [hostel, setHostel] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [images, setImages] = useState([]);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const hostelOptions = {
    "Main Campus": ["AMAN DAMAI", "BAKTI PERMAI", "CAHAYA GEMILANG", "FAJAR HARAPAN", "INDAH KEMBARA", "RESTU", "SAUJANA", "TEKUN"],
    "Engineering Campus": ["UTAMA", "LEMBARAN", "JAYA"],
    "Health Campus": ["MURNI", "NURANI"]
  };

  const steps = [
    { id: 1, title: 'Campus & Hostel' },
    { id: 2, title: 'Complaint Detail' },
    { id: 3, title: 'Confirmation' },
  ];

  const handleNext = () => {
    if (step === 1 && (!campus || !hostel)) {
      return alert("Please select campus and hostel.");
    }
    if (step === 2 && (!category || !description)) {
      return alert("Please complete complaint details.");
    }
    setStep(s => Math.min(3, s + 1));
  };

  const handlePrev = () => {
  if (step === 1) {
    onClose();
  } else {
    setStep((s) => s - 1);
  }
};

  const handleSubmit = (e) => {
    e && e.preventDefault && e.preventDefault();
    const newComplaint = {
      _id: makeId(),
      userId: currentUser.id,
      userName: currentUser.name,
      campus,
      hostel,
      category,
      description,
      priority,
      status: STATUS.PENDING,
      remarks: "",
      attachments: images,
      dateSubmitted: new Date().toISOString(),
      dateResolved: null,
      assignedTo: null,
    };
    onCreate(newComplaint);
    // show success state then close
    setIsSubmitted(true);
    setTimeout(() => {
      setIsSubmitted(false);
      onClose();
      // reset form (optional)
      setStep(1); setCampus(''); setHostel(''); setCategory(''); setDescription(''); setPriority('Medium'); setImages([]);
    }, 1200);
  };

  // framer-motion variants for slide animation
  const variants = {
    enter: (dir) => ({ x: dir > 0 ? 200 : -200, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir) => ({ x: dir < 0 ? 200 : -200, opacity: 0 }),
  };

  // overall layout is full-page centered card
  return (
    <div className="min-h-screen bg-indigo-50 py-10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-indigo-700">Register a Complaint</h1>
            <p className="text-gray-600 mt-1">Complete this form to report your complaint to the warden.</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Step header */}
          <div className="p-10 border-b bg-white">
            <div className="flex justify-between items-center">
              {steps.map((s, idx) => {
                const completed = step > s.id;
                const active = step === s.id;
                const isLast = idx === steps.length - 1;

                return (
                  <div key={s.id} className="flex-1 flex flex-col items-center relative">
                    {/* Step Circle */}
                    <div
                      className={`w-12 h-12 flex items-center justify-center rounded-full border-2 relative z-10
                        bg-white
                        ${completed
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : active
                          ? 'bg-blue-100 border-blue-400 text-blue-700'
                          : 'bg-gray-100 border-gray-300 text-gray-500'
                        }`}
                      style={{
                        boxShadow: '0 0 0 15px white',
                      }}
                    >
                      {completed ? (
                        <CheckCircle className="w-6 h-6 text-white" />
                      ) : (
                        <span className="text-lg font-semibold">{s.id}</span>
                      )}
                    </div>

                    {/* Connecting Line */}
                    {!isLast && (
                      <div
                        className={`absolute top-6 left-1/2 w-full h-[2px] 
                          ${completed ? 'bg-blue-600' : 'bg-gray-300'}`}
                        style={{
                          transform: 'translateX(0%)',
                          width: '100%',
                          zIndex: 0,
                        }}
                      />
                    )}

                    {/* Step Label */}
                    <div className="mt-6 text-center">
                      <div className={`text-xl font-semibold ${active ? 'text-blue-700' : 'text-gray-500'}`}>
                        {s.title}
                      </div>
                      <div className="text-m text-gray-400">
                        {idx === 0
                          ? 'Select campus & hostel'
                          : idx === 1
                          ? 'Enter details & images'
                          : 'Confirm & submit'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Main content: large card with animation */}
          <div className="p-8">
            {/* motion wrapper */}
            <div className="relative max-h-[200vh] overflow-y-auto pr-2">
            <motion.div
              key={step}
              custom={step}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.4 }}
              className="min-h-full"
            >
                {/* Step 1 */}
                {step === 1 && (
                  <div className="grid grid-cols-1 h-full">
                    <div className="p-6">
                      <h3 className="text-2xl font-semibold text-indigo-700 mb-2">Hostel Information</h3>
                      <p className="text-lg text-gray-600 mb-6">Select the campus and hostel which you would like to report.</p>

                      <label className="block mb-2 font-medium">Campus</label>
                      <select
                        value={campus}
                        onChange={(e) => { setCampus(e.target.value); setHostel(''); }}
                        className="w-full mb-6 p-3 border rounded-lg"
                      >
                        <option value="">Choose a campus</option>
                        {Object.keys(hostelOptions).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>

                      {campus && (
                        <>
                          <label className="block mb-2 font-medium">Hostel</label>
                          <select value={hostel} onChange={(e) => setHostel(e.target.value)} className="w-full p-3 border rounded-lg">
                            <option value="">Choose a hostel</option>
                            {hostelOptions[campus].map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </>
                      )}
                    </div>
                    
                  </div>
                )}

                {/* Step 2 */}
                {step === 2 && (
                  <form className="h-full grid grid-cols-1 gap-8" onSubmit={(e) => { e.preventDefault(); handleNext(); }}>
                    <div className="p-6">
                      <h3 className="text-2xl font-semibold text-indigo-700 mb-2">Complaint Information</h3>
                      <p className="text-lg text-gray-600 mb-6">Fill required fields and attach images (photo of issue recommended).</p>

                      <label className="block mb-2 font-medium">Category</label>
                      <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full mb-6 p-3 border rounded-lg">
                        <option value="">Select category</option>
                        <option>Plumbing</option>
                        <option>Electrical</option>
                        <option>Furniture</option>
                        <option>Room</option>
                        <option>Other</option>
                      </select>

                      <label className="block mb-2 font-medium">Priority</label>
                      <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full mb-6 p-3 border rounded-lg">
                        <option>Low</option>
                        <option>Medium</option>
                        <option>High</option>
                      </select>
                  
                      <label className="block mb-2 font-medium">Description</label>
                      <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={8} className="w-full p-3 border rounded-lg mb-6" placeholder="Describe the issue in detail..."></textarea>

                      <label className="block mb-4 font-medium flex items-center gap-2"><ImageIcon className="w-5 h-5" /> Upload Images</label>
                      <input type="file" multiple accept="image/*" onChange={(e) => setImages(Array.from(e.target.files))} className="mb-6" />

                    </div>
                  </form>
                )}

                {/* Step 3 */}
                {step === 3 && (
                   <div className="h-full grid grid-cols-1 gap-8">

                     <div className="p-6">
                       <h3 className="text-2xl font-semibold text-indigo-700 mb-2">Review & Confirm</h3>
                       <p className="text-lg text-gray-600 mb-6">Please verify all details before submitting.</p>

                      {/* Complaint Ticket */}
                      <div className="w-full bg-white border border-gray-200 shadow-lg rounded-2xl overflow-hidden">
                        {/* Header section */}
                        <div className="bg-gradient-to-r from-indigo-600 to-blue-500 text-white p-6 flex justify-between items-center">
                          <div>
                            <h3 className="text-2xl font-semibold">Complaint Ticket Preview</h3>
                          </div>
                          <div className="text-right">
                            <p
                              className={`text-sm font-bold px-3 py-1 rounded-full inline-block ${
                                priority === "High"
                                  ? "bg-red-500 text-white"
                                  : priority === "Medium"
                                  ? "bg-yellow-400 text-gray-800"
                                  : "bg-green-400 text-gray-800"
                              }`}
                            >
                              {priority}
                            </p>
                          </div>
                        </div>

                        {/* Body content */}
                        <div className="p-6 space-y-6">
                          <div className="grid grid-cols-2 gap-6">
                            <div>
                              <h4 className="text-sm font-medium text-gray-500 uppercase mb-1">Campus</h4>
                              <p className="text-gray-800 text-base font-semibold">{campus || "—"}</p>
                            </div>

                            <div>
                              <h4 className="text-sm font-medium text-gray-500 uppercase mb-1">Hostel</h4>
                              <p className="text-gray-800 text-base font-semibold">{hostel || "—"}</p>
                            </div>

                            <div>
                              <h4 className="text-sm font-medium text-gray-500 uppercase mb-1">Category</h4>
                              <p className="text-gray-800 text-base font-semibold">{category || "—"}</p>
                            </div>

                            <div>
                              <h4 className="text-sm font-medium text-gray-500 uppercase mb-1">Date</h4>
                              <p className="text-gray-800 text-base font-semibold">
                                {new Date().toLocaleDateString("en-MY")}
                              </p>
                            </div>
                          </div>

                          {/* Description box */}
                          <div>
                            <h4 className="text-sm font-medium text-gray-500 uppercase mb-2">Description</h4>
                            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-700 leading-relaxed min-h-[100px] whitespace-pre-wrap">
                              {description || "—"}
                            </div>
                          </div>

                          {/* Attachments */}
                          <div>
                            <h4 className="text-sm font-medium text-gray-500 uppercase mb-2">Attachments</h4>
                            {images.length > 0 ? (
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {images.map((f, i) => (
                                  <div
                                    key={i}
                                    className="relative group border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition"
                                  >
                                    <img
                                      src={URL.createObjectURL(f)}
                                      alt={`attachment-${i}`}
                                      className="w-full h-40 object-cover"
                                    />
                                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-40 text-white text-xs py-1 px-2 truncate">
                                      {f.name}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="p-4 bg-gray-50 border border-gray-200 text-gray-400 rounded-lg text-sm">
                                No images uploaded
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Footer bar (like a ticket stub) */}
                        <div className="border-t border-dashed border-gray-300 p-4 text-center text-gray-500 text-xs bg-gray-50">
                          Complaint ID will be generated upon submission.
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </div>

            {/* bottom quick controls */}
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-gray-500">Need help? Contact the warden for urgent issues.</div>
              <div className="flex items-center gap-5">
                {/* Back button */}
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="px-6 py-3 rounded border text-gray-700 hover:bg-gray-100 transition"
                  >
                    Back
                  </button>

                {/* Next / Submit button */}
                {step < steps.length ? (
                  <PrimaryButton onClick={handleNext} className="w-auto px-6">
                    Next
                  </PrimaryButton>
                ) : (
                  <PrimaryButton onClick={handleSubmit} className="w-auto px-6">
                    Submit
                  </PrimaryButton>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Complaint list component (common)
const ComplaintList = ({ list, onSelect, onBack}) => {
  const [filters, setFilters] = useState({
    category: "",
    campus: "",
    status: "",
  });
  const [sortBy, setSortBy] = useState("date");

  const categoryOptions = [...new Set(list.map((c) => c.category))];
  const campusOptions = [...new Set(list.map((c) => c.campus))];

  const filtered = useMemo(() => {
    let result = [...list];
    if (filters.category) result = result.filter((c) => c.category === filters.category);
    if (filters.campus) result = result.filter((c) => c.campus === filters.campus);
    if (filters.status) result = result.filter((c) => c.status === filters.status);

    if (sortBy === "priority") {
      const order = { High: 1, Medium: 2, Low: 3 };
      result.sort((a, b) => order[a.priority] - order[b.priority]);
    } else {
      result.sort((a, b) => new Date(b.dateSubmitted) - new Date(a.dateSubmitted));
    }
    return result;
  }, [list, filters, sortBy]);

  return (
    <div className="min-h-screen bg-indigo-50 py-10">
      <div className="max-w-7xl mx-auto px-6">
        {/* ===== HEADER ===== */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-indigo-700">Registered Complaint</h1>
            <p className="text-gray-600 mt-1">The list consists of all the registered complaints. Apply the filtering and sorting to view the complaints conviniently.</p>
          </div>
          <PrimaryButton className="w-auto px-6" onClick={onBack}>Back</PrimaryButton>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-3">
            {/* ===== CONTROL BAR ===== */}
            <div className="flex flex-wrap gap-3 text-sm items-center">
              <div className="flex items-center gap-2 text-gray-500 font-medium">
                <Filter className="w-4 h-4" />
                <span>Filter:</span>
              </div>

              <select
                className="px-3 py-2 border rounded-lg bg-gray-50 text-gray-700 hover:bg-white focus:ring-2 focus:ring-indigo-400"
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              >
                <option value="">All Categories</option>
                {categoryOptions.map((cat) => (
                  <option key={cat}>{cat}</option>
                ))}
              </select>

              <select
                className="px-3 py-2 border rounded-lg bg-gray-50 text-gray-700 hover:bg-white focus:ring-2 focus:ring-indigo-400"
                value={filters.campus}
                onChange={(e) => setFilters({ ...filters, campus: e.target.value })}
              >
                <option value="">All Campuses</option>
                {campusOptions.map((campus) => (
                  <option key={campus}>{campus}</option>
                ))}
              </select>

              <select
                className="px-3 py-2 border rounded-lg bg-gray-50 text-gray-700 hover:bg-white focus:ring-2 focus:ring-indigo-400"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <option value="">All Status</option>
                {Object.values(STATUS).map((s) => (
                  <option key={s}>{s.replace("_", " ")}</option>
                ))}
              </select>

              <div className="flex items-center gap-2 ml-2 text-gray-500 font-medium">
                <SortAsc className="w-4 h-4" />
                <span>Sort:</span>
              </div>

              <select
                className="px-3 py-2 border rounded-lg bg-gray-50 text-gray-700 hover:bg-white focus:ring-2 focus:ring-indigo-400"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="date">Latest</option>
                <option value="priority">Priority</option>
              </select>
            </div>
          </div>

          {/* ===== LIST ===== */}
          {filtered.length === 0 ? (
            <p className="text-gray-500 text-center py-10 italic">
              No complaints found.
            </p>
          ) : (
            <div className="space-y-4">
              {filtered.map((c) => (
                <button
                  key={c._id}
                  onClick={() => onSelect(c)}
                  className="group w-full text-left p-5 rounded-xl border border-gray-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 transition-all duration-300 flex justify-between items-start shadow-sm hover:shadow-md"
                >
                  <div className="flex-1">
                    {/* CATEGORY + STATUS */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-semibold text-gray-800 group-hover:text-indigo-700">
                          {c.category}
                        </span>
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                            c.priority === "High"
                              ? "border border-red-700 text-red-700"
                              : c.priority === "Medium"
                              ? "border border-yellow-700 text-yellow-700"
                              : "border border-green-700 text-green-700"
                          }`}
                        >
                          {c.priority}
                        </span>
                      </div>
                      <span
                        className={`text-sm px-5 py-2 rounded-lg font-semibold uppercase tracking-wide ${
                          c.status === STATUS.PENDING
                            ? "bg-yellow-100 text-yellow-700"
                            : c.status === STATUS.IN_PROGRESS
                            ? "bg-blue-100 text-blue-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {c.status.replace("_", " ")}
                      </span>
                    </div>

                    {/* CAMPUS + HOSTEL */}
                    <div className="flex flex-wrap gap-4 mb-3 text-sm text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-indigo-500" />
                        <span>{c.campus}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Home className="w-4 h-4 text-indigo-500" />
                        <span>{c.hostel}</span>
                      </div>
                    </div>

                    {/* DESCRIPTION */}
                    <div className="text-gray-700 text-sm leading-relaxed mb-3 line-clamp-3 py-3">
                      {c.description}
                    </div>

                    {/* META INFO */}
                    <div className="text-xs text-gray-400 flex justify-between">
                      <span>{c.userName}</span>
                      <span>{new Date(c.dateSubmitted).toLocaleString()}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ComplaintDetail = ({ complaint, currentUser, onClose, onUpdate, onGiveFeedback }) => {
  const [remarks, setRemarks] = useState("");
  const [assignedTo, setAssignedTo] = useState(complaint.assignedTo || "");
  const [status, setStatus] = useState(complaint.status);
  const [localRemarks, setLocalRemarks] = useState(complaint.remarks || "");
  const chatEndRef = useRef(null);

  if (!complaint) return null;

  const isWarden = currentUser.role === "warden";
  const isOriginallyResolved = complaint.status === STATUS.RESOLVED;

  const sendRemark = () => {
    if (!remarks.trim()) return;
    const newRemarkLine = `${currentUser.name}: ${remarks}`;
    const newRemarks = (localRemarks ? localRemarks + "\n" : "") + newRemarkLine;

    // 🟢 Update locally
    setLocalRemarks(newRemarks);
    setRemarks("");

    // 🔄 Sync to parent state
    onUpdate(complaint._id, { remarks: newRemarks });
  };

  const applyUpdate = () => {
    const updates = {};
    if (assignedTo !== complaint.assignedTo) updates.assignedTo = assignedTo || null;
    if (status !== complaint.status) {
      updates.status = status;
      updates.dateResolved = status === STATUS.RESOLVED ? new Date().toISOString() : null;
    }
    if (remarks.trim()) {
      const newRemarkLine = `${currentUser.name}: ${remarks}`;
      updates.remarks = (localRemarks ? localRemarks + "\n" : "") + newRemarkLine;
      setLocalRemarks((prev) => (prev ? prev + "\n" + newRemarkLine : newRemarkLine));
    }
    onUpdate(complaint._id, updates);
    setRemarks("");
    onClose();
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localRemarks]);

  const remarkList = (localRemarks || "")
    .split("\n")
    .filter(Boolean)
    .map((r, i) => {
      const [sender, ...msgParts] = r.split(": ");
      const msg = msgParts.join(": ");
      const isCurrentUser = sender === currentUser.name;
      return (
        <div key={i} className={`flex ${isCurrentUser ? "justify-end" : "justify-start"} mb-2`}>
          <div
            className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm ${
              isCurrentUser
                ? "bg-indigo-600 text-white rounded-br-none"
                : "bg-gray-200 text-gray-800 rounded-bl-none"
            }`}
          >
            {!isCurrentUser && (
              <div className="text-xs font-semibold text-gray-600 mb-1">{sender}</div>
            )}
            {msg}
          </div>
        </div>
      );
    });

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-6 backdrop-blur-sm">
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden relative animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b bg-gradient-to-r from-indigo-600 to-blue-500 text-white">
          <h3 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="w-6 h-6" />
            Complaint Details
          </h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/20 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 grid grid-cols-2 gap-8">
          {/* LEFT: Info */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-indigo-700 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Complaint Information
            </h4>

            <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-sm text-gray-700">
              <InfoRow label="Category" value={complaint.category} />
              <InfoRow
                label="Priority"
                value={
                  <span
                    className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                      complaint.priority === "High"
                        ? "bg-red-100 text-red-700"
                        : complaint.priority === "Medium"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {complaint.priority}
                  </span>
                }
              />
              <InfoRow label="Campus" value={complaint.campus} />
              <InfoRow label="Hostel" value={complaint.hostel} />
              <InfoRow
                label="Status"
                value={
                  <span
                    className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                      complaint.status === STATUS.PENDING
                        ? "bg-yellow-100 text-yellow-700"
                        : complaint.status === STATUS.IN_PROGRESS
                        ? "bg-blue-100 text-blue-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {complaint.status}
                  </span>
                }
              />
              <InfoRow label="Submitted by" value={complaint.userName} />
              <InfoRow
                label="Date Submitted"
                value={new Date(complaint.dateSubmitted).toLocaleString()}
              />
            </div>

            {/* Description */}
            <div className="mt-4">
              <h4 className="text-md font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-indigo-600" />
                Description
              </h4>
              <div className="p-4 bg-gray-50 rounded-xl text-gray-700 leading-relaxed whitespace-pre-line">
                {complaint.description}
              </div>
            </div>

            {/* Attachments */}
            <div className="mt-4">
              <h4 className="text-md font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                Attachments
              </h4>

              {complaint.attachments?.length ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 bg-gray-50 rounded-xl p-4">
                  {complaint.attachments.map((file, i) => (
                    <div
                      key={i}
                      className="relative group rounded-lg overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition"
                    >
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`attachment-${i}`}
                        className="w-full h-32 object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                        <a
                          href={URL.createObjectURL(file)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-white text-sm font-medium bg-indigo-600 hover:bg-indigo-700 px-3 py-1 rounded"
                        >
                          View Full
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-50 rounded-xl p-4 text-gray-400 italic">No attachments.</div>
              )}
            </div>
          </div>

          {/* RIGHT: Chat + Actions */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-indigo-700 flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Conversation
            </h4>

            <div className="bg-gray-50 rounded-xl p-4 flex flex-col flex-grow">
              {/* Chat window */}
              <div className="flex-grow overflow-y-auto bg-white border rounded-lg p-4 mb-4 h-72">
                {remarkList.length ? remarkList : (
                  <div className="h-full flex items-center justify-center text-gray-400 italic text-center">
                    No conversation yet.
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input + Send */}
              {!isOriginallyResolved && (
                <div className="flex items-center gap-2">
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={2}
                    placeholder="Type your message..."
                    className="flex-grow p-3 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                  />
                  <button
                    onClick={sendRemark}
                    className="p-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>

            {/* Warden-only controls */}
            {isWarden && (
              <div>
                <h4 className="text-lg font-semibold text-indigo-700 flex items-center gap-2">
                  <UserCog className="w-5 h-5" />
                  Actions & Updates
                </h4>

                <div className="bg-gray-50 rounded-xl p-4 flex flex-col flex-grow">
                  <div className="mt-4 space-y-3">
                    <label className="block text-sm font-medium">Change Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option>{STATUS.PENDING}</option>
                      <option>{STATUS.IN_PROGRESS}</option>
                      <option>{STATUS.RESOLVED}</option>
                    </select>

                    <label className="block text-sm font-medium">Assign to (staff)</label>
                    <input
                      value={assignedTo}
                      onChange={(e) => setAssignedTo(e.target.value)}
                      className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="Enter staff name"
                    />
                  </div>
                </div>
              </div>
            )}
            
            {/* Update button for warden */}
            { currentUser.role === "warden" && (
              <div className="flex justify-end pt-3">
                <PrimaryButton onClick={applyUpdate}>Update</PrimaryButton>
              </div>
            )}
            
            {/* Feedback button for student */}
            {isOriginallyResolved && currentUser.role === "student" && (
              <PrimaryButton onClick={onGiveFeedback}>
                Give Feedback
              </PrimaryButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Placeholder Student Dashboard
const StudentDashboard = ({ currentUser, onCreateComplaint, onViewComplaints, onLogout, navigateToFeedback, navigateToFeedbackList }) => (
  <div className="p-8 bg-indigo-50 min-h-screen">
    <div className="max-w-7xl mx-auto">
      <h1 className="text-3xl font-extrabold text-indigo-700 mb-6 border-b pb-2">Student Portal - HostelFix</h1>
      <div className="bg-white p-6 rounded-xl shadow-lg mb-8 flex justify-between items-center">
        <p className="text-lg text-gray-700">
          Welcome, {currentUser.name}! 👋 Get started by submitting a new complaint.
        </p>
        <PrimaryButton onClick={onLogout} className="w-auto px-6 bg-red-500 hover:bg-red-600 ml-4">
          <div className="flex items-center justify-center"><LogIn className="w-5 h-5 mr-2" /> Log Out</div>
        </PrimaryButton>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <DashboardCard 
          icon={AlertTriangle} 
          title="Register Complaint" 
          description="Log a new issue with your room or facilities." 
          color="text-red-500"
          onClick={onCreateComplaint}
        />
        <DashboardCard 
          icon={MessageSquare} 
          title="Complaint Tracking" 
          description="View your complaint status and history." 
          color="text-blue-500"
          onClick={onViewComplaints}
        />
        <DashboardCard 
          icon={Shield} 
          title="View Announcements" 
          description="See warden updates and maintenance schedules." 
          color="text-green-500" 
        />
            <DashboardCard
                icon={Shield}
                title="Submit Feedback"
                description="Share your thoughts on how your complaint was handled."
                color="text-green-500"
                onClick={navigateToFeedback}
            />
            <DashboardCard
                icon={Star}
                title="My Feedback"
                description="View and manage your submitted feedback."
                color="text-yellow-500"
                onClick={navigateToFeedbackList}
            />
      </div>
    </div>
  </div>
);

// Placeholder Warden Dashboard
const WardenDashboard = ({ onViewComplaints, onLogout, navigateToFeedbackView }) => (
  <div className="p-8 bg-gray-100 min-h-screen">
    <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-extrabold text-gray-800 mb-6 border-b pb-2">Warden Portal - HostelFix Management</h1>
        <div className="bg-white p-6 rounded-xl shadow-lg mb-8 flex justify-between items-center">
            <p className="text-lg text-gray-700">
                Welcome, Warden/Staff! Use the tools below to manage and resolve facility issues.
            </p>
            <PrimaryButton onClick={onLogout} className="w-auto px-6 bg-red-500 hover:bg-red-600 ml-4">
                <div className="flex items-center justify-center"><LogIn className="w-5 h-5 mr-2" /> Log Out</div>
            </PrimaryButton>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <DashboardCard 
                icon={AlertTriangle} 
                title="All Complaints" 
                description="Review and assign unhandled issues (Module 2)." 
                color="text-red-500"
                onClick={onViewComplaints}
            />
            <DashboardCard 
                icon={MessageSquare} 
                title="Feedback Review" 
                description="View student feedback and satisfaction ratings." 
                color="text-indigo-500" 
                onClick={navigateToFeedbackView}
            />
            <DashboardCard 
                icon={Shield} 
                title="Generate Reports" 
                description="Quarterly analytics on resolution times (Module 4)." 
                color="text-green-500" 
            />
        </div>
    </div>
  </div>
);

// --- Main App Component ---

const App = () => {
  const [view, setView] = useState("login"); // 'login', 'student', 'warden'
  const [currentUser, setCurrentUser] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [selected, setSelected] = useState(null);
  const [feedbackList, setFeedbackList] = useState([]);
  const [editingFeedback, setEditingFeedback] = useState(null); // NEW: track feedback being edited
  // Global message state for toast notifications
  const [isMessageVisible, setIsMessageVisible] = useState(false);
  const [message, setMessage] = useState({ title: "", text: "", type: "" });

  const showMessage = (title, text, type = "success", durationMs = 2500) => {
    setMessage({ title, text, type });
    setIsMessageVisible(true);
    if (durationMs > 0) {
      setTimeout(() => setIsMessageVisible(false), durationMs);
    }
  };

  useEffect(() => {
    const fetchFeedbacks = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "feedbacks"));
        const data = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setFeedbackList(data);
      } catch (error) {
        console.error("Error fetching feedbacks: ", error);
      }
    };

    fetchFeedbacks();
  }, []);

  const handleLoginSuccess = (role) => {
    setCurrentUser({
      id: role === "student" ? "u1" : "warden1",
      name: role === "student" ? "Alice Student" : "Warden User",
      role,
    });
    setView(role);
  };

  const handleLogout = () => {
    localStorage.removeItem("userRole"); // Clear persistent role on logout
    setView("login");
    setCurrentUser(null);
  };

  const handleCreateComplaint = (complaint) => {
    setComplaints((prev) => [complaint, ...prev]);
    showMessage("Complaint Submitted", "Your complaint has been submitted successfully.", "success");
  };

  const handleUpdateComplaint = (id, updates) => {
    setComplaints(prev => prev.map(c => c._id === id ? { ...c, ...updates } : c));
  };

  // --- Feedback Functions ---
  const handleFeedbackSubmit = async (feedback) => {
    try {
      if (editingFeedback) {
        const feedbackRef = doc(db, "feedbacks", feedback.id.toString());
        await updateDoc(feedbackRef, feedback);
        setFeedbackList((prev) => prev.map((f) => (f.id === feedback.id ? feedback : f)));
        setEditingFeedback(null);
        showMessage("Feedback Updated", "Your feedback has been updated.", "success");
      } else {
        const docRef = await addDoc(collection(db, "feedbacks"), feedback);
        setFeedbackList((prev) => [...prev, { ...feedback, id: docRef.id }]);
        showMessage("Feedback Submitted", "Thank you! Your feedback has been submitted.", "success");
      }
      setView("studentFeedbackList");
    } catch (error) {
      console.error("Error adding feedback: ", error);
      showMessage("Action Failed", "Could not submit feedback. Please try again.", "error", 2500);
    }
  };

  const handleDeleteFeedback = async (id) => {
    try {
      await deleteDoc(doc(db, "feedbacks", id.toString()));
      setFeedbackList((prev) => prev.filter((f) => f.id !== id));
      showMessage("Feedback Deleted", "Your feedback has been removed.", "success");
    } catch (error) {
      console.error("Error deleting feedback: ", error);
      showMessage("Delete Failed", "Could not delete feedback.", "error", 2500);
    }
  };

  const handleEditFeedback = (feedback) => {
    setEditingFeedback(feedback);
    setView("feedbackForm");
  };

  const handleCancelEdit = () => {
    setEditingFeedback(null);
    setView("studentFeedbackList");
  };

  const handleMarkReviewed = async (id) => {
    try {
      const feedbackRef = doc(db, "feedbacks", id);
      await updateDoc(feedbackRef, { reviewed: true });
      setFeedbackList((prev) => prev.map((f) => (f.id === id ? { ...f, reviewed: true } : f)));
      showMessage("Marked Reviewed", "Feedback marked as reviewed.", "success");
    } catch (error) {
      console.error("Error marking feedback as reviewed: ", error);
      showMessage("Update Failed", "Could not mark as reviewed.", "error", 2500);
    }
  };

  // --- View Controller ---
  const renderView = () => {
    switch (view) {
      case "student":
        return (
          <StudentDashboard
            currentUser={currentUser} 
            onCreateComplaint={() => setView("complaintForm")} 
            onViewComplaints={() => setView("complaintList")} 
            navigateToFeedback={() => setView("feedbackForm")}
            navigateToFeedbackList={() => setView("studentFeedbackList")}
            onLogout={handleLogout}
          />
        );

      case "warden":
        return (
          <WardenDashboard
            navigateToFeedbackView={() => setView("feedbackViewer")}
            onViewComplaints={()=> setView("complaintList")} 
            onLogout={handleLogout}
          />
        );

      case "complaintForm":
        return <ComplaintForm currentUser={currentUser} onCreate={handleCreateComplaint} onClose={() => setView("student")}/>;
      case "complaintList":
        return <ComplaintList list={complaints} filter={{ userId: currentUser.id }} onSelect={c=> { setSelected(c); setView("complaintDetail"); }} onBack={() => setView(currentUser.role === "student" ? "student" : "warden")}/>;
      case "complaintDetail":
        return <ComplaintDetail complaint={selected} currentUser={currentUser} onClose={() => setView("complaintList")} onUpdate={handleUpdateComplaint} />;
      case "login":
        return <LoginPage onLoginSuccess={handleLoginSuccess} />;

      case "feedbackForm":
        return (
          <FeedbackForm
            onBack={() => setView("student")}
            onSubmitFeedback={handleFeedbackSubmit}
            editingFeedback={editingFeedback}
            onCancelEdit={handleCancelEdit}
          />
        );

      case "feedbackViewer":
        return (
          <FeedbackViewer
            feedbackList={feedbackList}
            onBack={() => setView("warden")}
            onMarkReviewed={handleMarkReviewed}
          />
        );

      case "studentFeedbackList":
        return (
          <FeedbackList
            feedbackList={feedbackList}
            onBack={() => setView("student")}
            onDeleteFeedback={handleDeleteFeedback}
            onEditFeedback={handleEditFeedback}
          />
        );

      default:
        return <LoginPage onLoginSuccess={handleLoginSuccess} />;
    }
  };

  return (
    <div className="min-h-screen font-sans bg-gray-50">
      {isMessageVisible && (
        <MessageBox
          title={message.title}
          text={message.text}
          type={message.type}
          onClose={() => setIsMessageVisible(false)}
        />
      )}
      {renderView()}
    </div>
  );
};

=======
>>>>>>> 0dd28efafeb02ec09c54863e9c6e35215336ec0b
export default App;

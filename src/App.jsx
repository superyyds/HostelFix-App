// App.jsx
import React, { useState, useEffect, useCallback } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

// --- Import UI Component ---
import MessageBox from './components/MessageBox';

// --- Import API / Firebase Helpers ---
import { initializeApp } from "firebase/app";
import {
    getAuth, signOut, onAuthStateChanged, signInWithCustomToken, signInAnonymously
} from 'firebase/auth';
import {
    getFirestore, doc, getDoc, collection, query, where, getDocs, setLogLevel,
    onSnapshot, addDoc, updateDoc, deleteDoc
} from 'firebase/firestore';

// Pages / Module Components
import LoginPage from './pages/LoginPage';
import PasswordRecoveryPage from './pages/PasswordRecoveryPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import RegisterUserPage from './pages/RegisterUserPage';
import StudentDashboard from './pages/StudentDashboard';
import WardenDashboard from './pages/WardenDashboard';
import ProfileManagementPage from './pages/ProfileManagementPage';
import ComplaintForm from './pages/ComplaintForm';
import ComplaintList from './pages/ComplaintList';
import ComplaintDetail from './pages/ComplaintDetail';
import FeedbackForm from './pages/FeedbackForm';
import FeedbackViewer from './pages/FeedbackViewer';
import FeedbackList from './pages/FeedbackList';
import { wardenSessionCache } from './api/cache';

// --- Robust Configuration Loading ---
const appId = typeof __app_id !== 'undefined'
    ? __app_id
    : (import.meta.env.VITE_FIREBASE_APP_ID || 'default-app-id');

const firebaseConfig = typeof __firebase_config !== 'undefined'
    ? JSON.parse(__firebase_config)
    : {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
        measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
    };

const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// --- Initialize Firebase Services ---
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
setLogLevel('debug');

// --- Internal Firebase Helper Functions ---
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
        console.error("❌ DEBUG: Error fetching user role:", error);
        throw new Error("Failed to validate user role against database.");
    }
};

export const getUserFromFirestore = async (uid) => {
    if (!uid) return null;
    try {
        const userDocRef = doc(db, 'users', uid);
        const userDoc = await getDoc(userDocRef);
        return userDoc.exists() ? userDoc.data() : null;
    } catch (error) {
        console.error("Error fetching user data:", error);
        return null;
    }
};

// --- Global State Structure ---
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

// --- Main App Component (Router & Auth Logic) ---
const App = () => {
    const [appState, setAppState] = useState(initialUserState);
    const [isRegistering, setIsRegistering] = useState(false);
    const [lastWardenHash, setLastWardenHash] = useState(null);
    const [isLoginCheckFailed, setIsLoginCheckFailed] = useState(false);
    const [isMessageVisible, setIsMessageVisible] = useState(false);
    const [message, setMessage] = useState({ title: "", text: "", type: "" });
    const [isManualLogout, setIsManualLogout] = useState(false);
    const [manualLogout, setManualLogout] = useState(false);
    
    // complaint
    const [complaints, setComplaints] = useState([]);
    const [selected, setSelected] = useState(null);

    // feedback
    const [feedbackList, setFeedbackList] = useState([]);
    const [editingFeedback, setEditingFeedback] = useState(null);

    const closeMessage = () => setIsMessageVisible(false);

    // Helper to determine initial view from URL hash
    const getInitialView = useCallback(() => {
        const hash = window.location.hash.replace(/^#\/?/, '');
        const publicViews = ['password-recovery', 'login', 'change-password'];

        if (publicViews.includes(hash)) {
            return hash;
        }

        // Allow all authenticated subpages to stay
        const allowedAuthViews = [
            'warden', 'student',
            'register-user',
            'profile-management',
            'change-password-voluntary',
            'complaintList',
            'complaintDetail',
            'complaintForm',
            'feedbackViewer',
            'studentFeedbackList',
            'feedbackForm'
        ];

        if (allowedAuthViews.includes(hash)) {
            return hash;
        }

        // Default to login if truly invalid
        return 'login';
    }, []);

    const [view, setView] = useState(getInitialView());

    // Handles view changes and updates URL hash
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

    // FIXED: Registration complete handler with proper loading states
    const handleRegistrationStart = () => {
        console.log("🔒 DEBUG: Starting registration - locking auth state changes");
        setIsRegistering(true);
    };

    const handleRegistrationComplete = (status = null, registrationData = null) => {
        console.log("🔒 DEBUG: Registration complete - unlocking auth state changes");
        
        if (status === 'success') {
            setMessage({
                title: "Account Created! 🎉",
                text: `A new student account for ${registrationData.name} (${registrationData.hostelId}) has been created successfully. Temporary Password: ${registrationData.tempPassword}. The student will be forced to change this password upon first login.`,
                type: "success"
            });
            setIsMessageVisible(true);
            
            // Auto-hide message after 5 seconds
            setTimeout(() => {
                setIsMessageVisible(false);
            }, 5000); // 5000ms = 5 seconds
            // Keep the warden on the register page after success
             setTimeout(() => {
                 setIsRegistering(false);
                 handleViewChange('register-user');
             }, 100);
        } else if (status === 'error') {
            setIsRegistering(false);
            setLastWardenHash(null);
            console.log("Registration failed");
        } else {
            // For cancel or other cases
            setIsRegistering(false);
        }
    };

    // Sync state with URL hash
    useEffect(() => {
        const handleHashChange = () => {
            const newHash = window.location.hash.replace(/^#\/?/, '');
            if (newHash && newHash !== view && appState.isAuthReady) {
                setView(newHash);
            }
        };

        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [view, appState.isAuthReady]);

    // FIXED: Auth State Listener with better registration lock
    useEffect(() => {
        let isInitialLoad = true;
        const unsubscribe = onAuthStateChanged(auth, async (user) => {

            if (isManualLogout) {
            console.log("🔒 DEBUG: Manual logout in progress - ignoring auth state change");
            return;
        }
            // CRITICAL LOCK: If a registration sequence is active, ignore all transient changes.
            if (isRegistering || isLoginCheckFailed) {
                console.log("🔒 DEBUG: Ignoring transient auth state change during registration.");
                if (isLoginCheckFailed) {
                    setIsLoginCheckFailed(false); 
                }
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
                    console.log("🔧 DEBUG: Auth state change - Current hash:", currentHash, "Role:", userData.role);

                    // WORKING LOGIC: Warden register page priority
                    if (userData.role === 'warden' && lastWardenHash === 'register-user') {
                        console.log("🔧 DEBUG: Warden was on register page - forcing return");
                        handleViewChange('register-user');
                        return;
                    }

                    // WORKING LOGIC: If warden is currently on register page, STAY there
                    if (currentHash === 'register-user' && userData.role === 'warden') {
                        console.log("🔧 DEBUG: Warden staying on register-user page");
                        return;
                    }

                    // Only handle mandatory password changes for students
                    if (userData.mustChangePassword && userData.role === 'student') {
                        handleViewChange('change-password');
                        return;
                    }

                    // Only redirect away from public pages
                    if (currentHash === 'login' || currentHash === 'password-recovery') {
                        handleViewChange(userData.role);
                        return;
                    }

                    // If no specific routing needed and no current hash, go to role-based dashboard
                    if (!currentHash || currentHash === '') {
                        handleViewChange(userData.role);
                    }

                } catch (error) {
                    console.error("❌ CRITICAL AUTH/ROLE CHECK ERROR:", error);
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

        // const initializeAuth = async () => {
        //     if (manualLogout) return;
        //     if (initialAuthToken) {
        //         try {
        //             await signInWithCustomToken(auth, initialAuthToken);
        //         } catch (e) {
        //             console.error("Custom token sign-in failed, trying anonymous:", e);
        //             try { await signInAnonymously(auth); } catch (err) { console.error("Anonymous sign-in failed:", err); }
        //         }
        //     } else if (!auth.currentUser) {
        //         try { await signInAnonymously(auth); } catch (err) { console.error("Anonymous sign-in failed:", err); }
        //     }
        // };

        // if (!auth.currentUser) {
        //   initializeAuth();
        // }

        return () => unsubscribe();
    }, [isRegistering, lastWardenHash, isLoginCheckFailed, isManualLogout]);

    // feedback fetching
    useEffect(() => {
        if (!appState.isAuthReady) {
            console.log("Waiting for auth before fetching feedback...");
            return;
        }

        let unsubscribe = () => { };

        const fetchFeedbacks = async () => {
            try {
                const feedbackCollectionPath = "feedbacks";
                const q = query(collection(db, feedbackCollectionPath));

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

    const handleProfileUpdate = (updatedUserDataFromChild) => {
        console.log("APP_STATE: Profile data is being updated globally.", updatedUserDataFromChild);
        setAppState(prev => ({
            ...prev,
            userData: updatedUserDataFromChild
        }));
    };

    // const handleLoginSuccess = ({ role, userDocId, mustChange, userData }) => {
    //     setAppState(prev => ({
    //         ...prev,
    //         role: role,
    //         userId: auth.currentUser.uid,
    //         userDocId: userDocId,
    //         isAuthenticated: true,
    //         isAuthReady: true,
    //         mustChangePassword: mustChange,
    //         forceMandatoryChange: mustChange,
    //         userData: userData
    //     }));

    //     if (mustChange && role === 'student') {
    //         handleViewChange('change-password');
    //     } else {
    //         handleViewChange(role);
    //     }
    // };

    const handleLoginSuccess = () => {
    console.log("Login success signal received from LoginPage. Waiting for auth listener...");
    };

    // const handleForcedPasswordChangeComplete = () => {
    //     setAppState(prev => ({
    //         ...prev,
    //         mustChangePassword: false,
    //         forceMandatoryChange: false
    //     }));
    //     handleViewChange(appState.role);
    // };
    
    const handleForcedPasswordChangeComplete = async () => {
    try {
        if (!appState.userDocId) {
            throw new Error("No user document ID found in state. Cannot update password flag.");
        }
        
        // 1. Get the reference to the user's document
        const userDocRef = doc(db, 'users', appState.userDocId);
        
        // 2. Update the database field to 'false'
        await updateDoc(userDocRef, {
            mustChangePassword: false
        });

        // 3. If database update succeeds, update the local React state
        setAppState(prev => ({
            ...prev,
            mustChangePassword: false,
            forceMandatoryChange: false
        }));

        // 4. Finally, send the user to their dashboard
        handleViewChange(appState.role);
        
    } catch (error) {
        // If the database write fails, show an error and keep them on the page
        console.error("CRITICAL: Failed to update mustChangePassword flag in database:", error);
        setMessage({
            title: "Update Failed",
            text: "Your password was changed, but we failed to save the update. Please try again or contact support.",
            type: "error"
        });
        setIsMessageVisible(true);
    }
};

   // const isManualLogoutRef = React.useRef(false);

    const handleLogout = async () => {
    try {
        // USE STATE VERSION (not ref) since auth listener checks state
        setIsManualLogout(true);
        setManualLogout(true);
        setLastWardenHash(null);
        
        // Clear the cached warden credentials on manual logout
        wardenSessionCache.email = null;
        wardenSessionCache.password = null;

        console.log("🚪 Starting manual logout...");
        await signOut(auth);
        console.log("✅ Manual logout completed");
        
        handleViewChange("login");
        
        // Reset after successful logout (with delay to prevent immediate re-login)
        setTimeout(() => {
            setIsManualLogout(false);
            setManualLogout(false);
            console.log("🔄 Manual logout flag reset");
        }, 1000); // Increased to 1 second for safety
        
    } catch (error) {
        console.error("Logout error:", error);
        
        // Also clear cache on error, just in case
        wardenSessionCache.email = null;
        wardenSessionCache.password = null;
        
        setIsManualLogout(false);
        setManualLogout(false);
    }
};
    
    const handleForgotPasswordClick = () => {
        handleViewChange("password-recovery");
    };

    const handleBackToLogin = () => {
        handleViewChange("login");
    };

    // Complaint handlers
    const handleCreateComplaint = (complaint) => {
        setComplaints((prev) => [complaint, ...prev]);
    };

    // Feeedback handlers
    const handleFeedbackSubmit = async (feedback) => {
        try {
            if (editingFeedback) {
                // Update existing feedback
                const feedbackRef = doc(db, "feedbacks", feedback.id.toString());
                await updateDoc(feedbackRef, feedback);
                setFeedbackList((prev) => prev.map((f) => (f.id === feedback.id ? feedback : f)));
            } else {
                // Add new feedback
                const docRef = await addDoc(collection(db, "feedbacks"), feedback);
                setFeedbackList((prev) => [...prev, { ...feedback, id: docRef.id }]);
            }
            setEditingFeedback(null);
            setView("studentFeedbackList");
        } catch (error) {
            console.error("Error adding feedback: ", error);
        }
    };

    const handleDeleteFeedback = async (id) => {
        try {
            await deleteDoc(doc(db, "feedbacks", id.toString()));
            setFeedbackList((prev) => prev.filter((f) => f.id !== id));
        } catch (error) {
            console.error("Error deleting feedback: ", error);
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
            const feedbackCollectionPath = "feedbacks";
            const feedbackRef = doc(db, feedbackCollectionPath, id);
            await updateDoc(feedbackRef, { reviewed: true });
        } catch (error) {
            console.error("Error marking feedback as reviewed: ", error);
        }
    };

    const renderView = () => {
        // FIXED: Show loading screen during registration
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
                    <PrimaryButton onClick={handleBackToLogin} className="mt-4 w-auto px-6">
                        Back to Login
                    </PrimaryButton>
                </div>
            );
        }

        if (!appState.isAuthenticated) {
            switch (view) {
                case "password-recovery":
                    return <PasswordRecoveryPage onBackToLogin={handleBackToLogin} />;
                case "login":
                default:
                    return (
                        <LoginPage
                            onLoginSuccess={handleLoginSuccess}
                            onForgotPassword={handleForgotPasswordClick}
                            onLoginFailure={setIsLoginCheckFailed}
                        />
                    );
            }
        }

        // Mandatory Password Change Gate (Forces student users)
        if (appState.forceMandatoryChange && appState.role === "student") {
            if (view !== "change-password") {
                handleViewChange("change-password");
            }
            return (
                <ChangePasswordPage
                    onPasswordChangeComplete={handleForcedPasswordChangeComplete}
                    userId={appState.userId}
                    userDocId={appState.userDocId}
                    userRole={appState.role}
                    isVoluntary={false}
                    onCancel={null}
                />
            );
        }

        switch (view) {
            case "student":
                return (
                    <StudentDashboard
                        onLogout={handleLogout}
                        name={appState.userData?.name || ""}
                        hostelId={appState.userData?.hostelId || ""}
                        userRole={appState.role}
                        onViewChange={handleViewChange}
                    />
                );

            case "warden":
                return (
                    <WardenDashboard
                        onLogout={handleLogout}
                        userId={appState.userId}
                        userDocId={appState.userDocId}
                        userRole={appState.role}
                        onViewChange={handleViewChange}
                    />
                );

            case "register-user":
                // WORKING LOGIC: Explicitly handle register-user view for warden
                if (appState.role === "warden") {
                    return (
                        <RegisterUserPage
                            onBackToDashboard={() => handleViewChange("warden")}
                            onRegistrationStart={handleRegistrationStart}
                            onRegistrationComplete={handleRegistrationComplete}
                        />
                    );
                }

                return (
                    <MessageBox
                        title="Unauthorized Access"
                        text="Only wardens are allowed to register new users."
                        type="error"
                        onClose={() => handleViewChange(appState.role)}
                    />
                );

            case "profile-management":
                if (!appState.userData) {
                    return (
                        <div className="min-h-screen flex items-center justify-center bg-gray-50">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mr-3" />
                            <p className="text-xl text-indigo-700 font-semibold">Loading Profile...</p>
                        </div>
                    );
                }
                return (
                    <ProfileManagementPage
                        appState={appState}
                        onBackToDashboard={() => handleViewChange(appState.role)}
                        onPasswordChange={() => handleViewChange("change-password-voluntary")}
                        onProfileUpdated={handleProfileUpdate}
                    />
                );

            case "change-password-voluntary":
                return (
                    <ChangePasswordPage
                        onPasswordChangeComplete={() => handleViewChange(appState.role)}
                        userId={appState.userId}
                        userDocId={appState.userDocId}
                        userRole={appState.role}
                        isVoluntary={true}
                        onCancel={() => handleViewChange("profile-management")}
                    />
                );

            case "complaintForm":
                return (
                    <ComplaintForm
                        currentUser={appState.userData}
                        onCreate={handleCreateComplaint}
                        onClose={() => handleViewChange("student")}
                    />
                );

            case "complaintList":
                return <ComplaintList 
                            currentUser={appState.userData}
                            onSelect={c=> { setSelected(c); handleViewChange("complaintDetail"); }}
                            onBack={() => { setSelected(null); handleViewChange(appState.role); }}
                        />;
                    
            case "complaintDetail":
                return <ComplaintDetail
                            complaint={selected}
                            currentUser={appState.userData}
                            onClose={() => { setSelected(null); handleViewChange("complaintList") }}
                            onGiveFeedback={() => handleViewChange("feedbackForm")}
                    />;
            
            case "feedbackForm":
                return (
                    <FeedbackForm
                        onBack={() => handleViewChange("student")}
                        onSubmitFeedback={handleFeedbackSubmit}
                        editingFeedback={editingFeedback}
                        onCancelEdit={handleCancelEdit}
                        currentUser={appState.userData}
                        complaintList={selected}
                    />
                );

            case "feedbackViewer":
                return (
                    <FeedbackViewer
                        feedbackList={feedbackList}
                        onBack={() => handleViewChange("warden")}
                        onMarkReviewed={handleMarkReviewed}
                    />
                );

            case "studentFeedbackList":
                const studentFeedback = feedbackList.filter(
                    (f) => f.userId === appState.userId
                );
                return (
                    <FeedbackList
                        feedbackList={studentFeedback}
                        onBack={() => handleViewChange("student")}
                        onDeleteFeedback={handleDeleteFeedback}
                        onEditFeedback={handleEditFeedback}
                    />
                );

            default:
                if (appState.role === "warden") {
                    return (
                        <WardenDashboard
                            onLogout={handleLogout}
                            userId={appState.userId}
                            userDocId={appState.userDocId}
                            userRole={appState.role}
                            onViewChange={handleViewChange}
                        />
                    );
                }
                if (appState.role === "student") {
                    return (
                        <StudentDashboard
                            onLogout={handleLogout}
                            userId={appState.userId}
                            userDocId={appState.userDocId}
                            userRole={appState.role}
                            onViewChange={handleViewChange}
                        />
                    );
                }
                return (
                    <div className="min-h-screen flex items-center justify-center bg-gray-50">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mr-3" />
                        <p className="text-xl text-indigo-700 font-semibold">
                            Finalizing session...
                        </p>
                    </div>
                );
        }
    };

    return (
        <div className="min-h-screen font-sans bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
            {isMessageVisible && (
                <MessageBox title={message.title} text={message.text} type={message.type} onClose={closeMessage} />
            )}
            {renderView()}
        </div>
    );
};

export default App;
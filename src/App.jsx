// App.jsx
import React, { useState, useEffect, useCallback } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc } from "firebase/firestore";

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
                const feedbackCollectionPath = `artifacts/${appId}/public/data/feedbacks`;
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
                setEditingFeedback(null);
            } else {
                // Add new feedback
                const docRef = await addDoc(collection(db, "feedbacks"), feedback);
                setFeedbackList((prev) => [...prev, { ...feedback, id: docRef.id }]);
            }
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
            const feedbackCollectionPath = `artifacts/${appId}/public/data/feedbacks`;
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
// //App.jsx
// import React, { useState, useEffect, useCallback } from "react";
// import { AlertTriangle, Loader2 } from "lucide-react";

// // --- Import UI Component ---
// import MessageBox from './components/MessageBox';
// import PrimaryButton from './components/PrimaryButton';

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
// import ProfileManagementPage from './pages/ProfileManagementPage';
// import ComplaintForm from './pages/ComplaintForm';
// import ComplaintList from './pages/ComplaintList';
// import ComplaintDetail from './pages/ComplaintDetail';
// import FeedbackForm from './pages/FeedbackForm';
// import FeedbackViewer from './pages/FeedbackViewer';
// import FeedbackList from './pages/FeedbackList';

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
// export let wardenSessionCache = { email: null, password: null };

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
//     const [isMessageVisible, setIsMessageVisible] = useState(false);
//     const [message, setMessage] = useState({ title: "", text: "", type: "" });

//     // complaint + feedback
//     const [complaints, setComplaints] = useState([]);
//     const [selected, setSelected] = useState(null);
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
//             'warden', 'student',
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

//     // Function to manage the state and view after registration completes
//     const handleRegistrationComplete = (isStarting, status = null, registrationData = null) => {
//         setIsRegistering(isStarting);

//         if (!isStarting && status === 'success') {
//             setMessage({
//                 title: "Account Created! 🎉",
//                 text: `A new student account for ${registrationData.name} (${registrationData.hostelId}) has been created successfully. Temporary Password: ${registrationData.tempPassword}. The student will be forced to change this password upon first login.`,
//                 type: "success"
//             });
//             setIsMessageVisible(true);

//             setTimeout(() => {
//                 setIsMessageVisible(false);
//             }, 5000);

//             setTimeout(() => {
//                 handleViewChange('register-user');
//             }, 100);
//         } else if (!isStarting && status === 'error') {
//             setLastWardenHash(null);
//             console.log("Registration failed, resetting warden hash.");
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

//     // Auth State Listener and Routing Enforcement
//     useEffect(() => {
//         let isInitialLoad = true;
//         const unsubscribe = onAuthStateChanged(auth, async (user) => {

//             if (isRegistering) {
//                 console.log("🔒 DEBUG: Ignoring transient auth state change during registration.");
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

//                     if (isInitialLoad) {
//                         const allowStayViews = [
//                             "register-user",
//                             "change-password-voluntary",
//                             "change-password",
//                             "profile-management",
//                             "complaintList",
//                             "complaintDetail",
//                             "complaintForm",
//                             "feedbackViewer",
//                             "studentFeedbackList",
//                             "feedbackForm"
//                         ];

//                         if (userData.role === "warden" && lastWardenHash === "register-user") {
//                             // Stay on register-user page if warden just came from there
//                             handleViewChange("register-user");
//                         } else if (userData.mustChangePassword && userData.role === "student") {
//                             // Force students to change password first time
//                             handleViewChange("change-password");
//                         } else if (
//                             !currentHash || currentHash === "" ||
//                             currentHash === "login" || currentHash === "password-recovery"
//                         ) {
//                             // Send to default dashboard if blank or public page
//                             handleViewChange(userData.role);
//                         } else if (!allowStayViews.includes(currentHash)) {
//                             // Any unrecognized hash: only redirect if it’s not an allowed subpage
//                             if (userData.role !== "warden" || currentHash !== "register-user") {
//                                 handleViewChange(userData.role);
//                             }
//                         }
//                     }

//                     // if (isInitialLoad) {
//                     //     if (userData.role === 'warden' && lastWardenHash === 'register-user') {
//                     //         handleViewChange('register-user');
//                     //     } else if (userData.mustChangePassword && userData.role === 'student') {
//                     //         handleViewChange('change-password');
//                     //     } else if (currentHash === 'login' || currentHash === 'password-recovery' || currentHash === 'change-password') {
//                     //         handleViewChange(userData.role);
//                     //     } else if (!currentHash || currentHash === '') {
//                     //         handleViewChange(userData.role);
//                     //     }
//                     // }

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

//         const initializeAuth = async () => {
//             if (manualLogout) return; // don't auto-sign-in after manual logout
//             if (initialAuthToken) {
//                 try {
//                     await signInWithCustomToken(auth, initialAuthToken);
//                 } catch (e) {
//                     console.error("Custom token sign-in failed, trying anonymous:", e);
//                     try { await signInAnonymously(auth); } catch (err) { console.error("Anonymous sign-in failed:", err); }
//                 }
//             } else if (!auth.currentUser) {
//                 try { await signInAnonymously(auth); } catch (err) { console.error("Anonymous sign-in failed:", err); }
//             }
//         };

//         if (!auth.currentUser) {
//             initializeAuth();
//         }

//         return () => unsubscribe();
//     }, [isRegistering, lastWardenHash]); // keep minimal deps to avoid loops

//     // feedback fetching
//     useEffect(() => {
//         if (!appState.isAuthReady) {
//             console.log("Waiting for auth before fetching feedback...");
//             return;
//         }

//         let unsubscribe = () => { };

//         const fetchFeedbacks = async () => {
//             try {
//                 const feedbackCollectionPath = `artifacts/${appId}/public/data/feedbacks`;
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

//     const handleLoginSuccess = ({ role, userDocId, mustChange, userData }) => {
//         setAppState(prev => ({
//             ...prev,
//             role: role,
//             userId: auth.currentUser.uid,
//             userDocId: userDocId,
//             isAuthenticated: true,
//             isAuthReady: true,
//             mustChangePassword: mustChange,
//             forceMandatoryChange: mustChange,
//             userData: userData
//         }));

//         if (mustChange && role === 'student') {
//             handleViewChange('change-password');
//         } else {
//             handleViewChange(role);
//         }
//     };

//     const handleForcedPasswordChangeComplete = () => {
//         setAppState(prev => ({
//             ...prev,
//             mustChangePassword: false,
//             forceMandatoryChange: false
//         }));
//         handleViewChange(appState.role);
//     };
    
//     // Add this
//     const [manualLogout, setManualLogout] = useState(false);

//     // In App.jsx, update the handleLogout function and add a state reset:

// // In App.jsx, update the handleLogout function and add a state reset:

//     const handleLogout = async () => {
//     try {
//         setManualLogout(true);
//         wardenSessionCache.email = null;
//         wardenSessionCache.password = null;
//         setLastWardenHash(null);
//         await signOut(auth);
//         handleViewChange("login");
        
//         // Reset manualLogout after a short delay to allow normal auth flow to resume
//         setTimeout(() => setManualLogout(false), 1000);
//     } catch (error) {
//         console.error("Logout error:", error);
//         setManualLogout(false); // Reset even on error
//     }
// };

//     // const handleLogout = async () => {
//     //     try {
//     //         wardenSessionCache.email = null;
//     //         wardenSessionCache.password = null;
//     //         setLastWardenHash(null);
//     //         await signOut(auth);
//     //         // onAuthStateChanged will handle the view change
//     //         handleViewChange("login");
//     //     } catch (error) {
//     //         console.error("Logout error:", error);
//     //     }
//     // };

//     const handleForgotPasswordClick = () => {
//         handleViewChange("password-recovery");
//     };

//     const handleBackToLogin = () => {
//         handleViewChange("login");
//     };

//     // Complaint handlers (mocked for now)
//     const handleCreateComplaint = (complaint) => {
//         setComplaints((prev) => [complaint, ...prev]);
//         console.log("Complaint created (mock):", complaint);
//     };

//     const handleUpdateComplaint = (id, updates) => {
//         setComplaints(prev => prev.map(c => c._id === id ? { ...c, ...updates } : c));
//         console.log("Complaint updated (mock):", id, updates);
//     };

//     // Feedback handlers
//     const handleFeedbackSubmit = async (feedback) => {
//         try {
//             const feedbackCollectionPath = `artifacts/${appId}/public/data/feedbacks`;
//             if (editingFeedback) {
//                 const feedbackRef = doc(db, feedbackCollectionPath, feedback.id.toString());
//                 await updateDoc(feedbackRef, feedback);
//                 setEditingFeedback(null);
//             } else {
//                 await addDoc(collection(db, feedbackCollectionPath), {
//                     ...feedback,
//                     userId: appState.userId,
//                 });
//             }
//             handleViewChange("studentFeedbackList");
//         } catch (error) {
//             console.error("Error adding feedback: ", error);
//         }
//     };

//     const handleDeleteFeedback = async (id) => {
//         try {
//             const feedbackCollectionPath = `artifacts/${appId}/public/data/feedbacks`;
//             await deleteDoc(doc(db, feedbackCollectionPath, id.toString()));
//         } catch (error) {
//             console.error("Error deleting feedback: ", error);
//         }
//     };

//     const handleEditFeedback = (feedback) => {
//         setEditingFeedback(feedback);
//         handleViewChange("feedbackForm");
//     };

//     const handleCancelEdit = () => {
//         setEditingFeedback(null);
//         handleViewChange("studentFeedbackList");
//     };

//     const handleMarkReviewed = async (id) => {
//         try {
//             const feedbackCollectionPath = `artifacts/${appId}/public/data/feedbacks`;
//             const feedbackRef = doc(db, feedbackCollectionPath, id);
//             await updateDoc(feedbackRef, { reviewed: true });
//         } catch (error) {
//             console.error("Error marking feedback as reviewed: ", error);
//         }
//     };

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
//                     <PrimaryButton onClick={handleBackToLogin} className="mt-4 w-auto px-6">
//                         Back to Login
//                     </PrimaryButton>
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

//             case "register-user":
//                 // ✅ FIXED: render RegisterUserPage for wardens; non-wardens see MessageBox (no redirect loop)
//                 if (appState.role === "warden") {
//                     return (
//                         <RegisterUserPage
//                             onBackToDashboard={() => handleViewChange("warden")}
//                             onRegistrationComplete={(status, data) =>
//                                 handleRegistrationComplete(false, status, data)
//                             }
//                         />
//                     );
//                 }

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
//                 // ✅ FIXED: call handleViewChange with appState.role after success (go back to dashboard)
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
//                 const userComplaints =
//                     appState.role === "student"
//                         ? complaints.filter((c) => c.userId === appState.userId)
//                         : complaints;
//                 return (
//                     <ComplaintList
//                         list={userComplaints}
//                         onSelect={(c) => {
//                             setSelected(c);
//                             handleViewChange("complaintDetail");
//                         }}
//                         onBack={() => handleViewChange(appState.role)}
//                     />
//                 );

//             case "complaintDetail":
//                 return (
//                     <ComplaintDetail
//                         complaint={selected}
//                         currentUser={appState.userData}
//                         onClose={() => handleViewChange("complaintList")}
//                         onUpdate={handleUpdateComplaint}
//                         onGiveFeedback={() => handleViewChange("feedbackForm")}
//                     />
//                 );

//             case "feedbackForm":
//                 return (
//                     <FeedbackForm
//                         onBack={() => handleViewChange("student")}
//                         onSubmitFeedback={handleFeedbackSubmit}
//                         editingFeedback={editingFeedback}
//                         onCancelEdit={handleCancelEdit}
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
//                 // Fallback: safe dashboard render (no redirects)
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

// import React, { useState, useEffect } from "react";
// import { AlertTriangle, Loader2 } from "lucide-react";
// import { motion } from "framer-motion";

// // --- Import UI Component ---
// // Only the global MessageBox is needed here for displaying messages system-wide.
// import MessageBox from './components/MessageBox';
// import PrimaryButton from './components/PrimaryButton';

// // --- Import API / Firebase Helpers ---
// import { 
//     auth, 
//     signOut, 
//     fetchUserRole, 
//     wardenSessionCache,
//     onAuthStateChanged,
//     getUserFromFirestore,
// } from './api/firebase';

// // User Managemnent Module Components
// import LoginPage from './pages/LoginPage';
// import PasswordRecoveryPage from './pages/PasswordRecoveryPage';
// import ChangePasswordPage from './pages/ChangePasswordPage';
// import RegisterUserPage from './pages/RegisterUserPage';
// import StudentDashboard from './pages/StudentDashboard';
// import WardenDashboard from './pages/WardenDashboard';
// import ProfileManagementPage from './pages/ProfileManagementPage';
// import ComplaintForm from './pages/ComplaintForm';
// import ComplaintList from './pages/ComplaintList';
// import ComplaintDetail from './pages/ComplaintDetail';
// import FeedbackForm from './pages/FeedbackForm';
// import FeedbackViewer from './pages/FeedbackViewer';
// import FeedbackList from './pages/FeedbackList';

// // --- Global State Structure ---
// const initialUserState = {
//     userId: null,
//     userDocId: null,
//     role: null,
//     loading: false,
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
//     const [isMessageVisible, setIsMessageVisible] = useState(false);
//     const [message, setMessage] = useState({ title: "", text: "", type: "" });

//     // complaint + feedback
//     const [complaints, setComplaints] = useState([]);
//     const [selected, setSelected] = useState(null);
//     const [feedbackList, setFeedbackList] = useState([]);
//     const [editingFeedback, setEditingFeedback] = useState(null); // NEW: track feedback being edited

//     const closeMessage = () => setIsMessageVisible(false);

//     // Helper to determine initial view from URL hash
//     const getInitialView = () => {
//         const hash = window.location.hash.replace(/^#\/?/, '');
//         const publicViews = ['password-recovery', 'login', 'change-password'];
        
//         if (publicViews.includes(hash)) {
//             return hash;
//         }

//         if (hash && hash !== 'login') {
//             window.location.hash = '/login';
//         }

//         return 'login';
//     };

//     const [view, setView] = useState(getInitialView());

//     // Handles view changes and updates URL hash
//     const handleViewChange = (newView) => {
//         if (view !== newView) {
//             setView(newView);
//             window.location.hash = `/${newView}`;
            
//             // Track when warden navigates to register page
//             if (newView === 'register-user' && appState.role === 'warden') {
//                 setLastWardenHash('register-user');
//             }
//         }
//     };
    
//     // Function to manage the state and view after registration completes
//     const handleRegistrationComplete = (isStarting, status = null, registrationData = null) => {
//         // 1. Set the global flag to lock/unlock the onAuthStateChanged listener
//         setIsRegistering(isStarting);

//         if (!isStarting && status === 'success') {
//             // 2. Show success message
//             setMessage({
//                 title: "Account Created! 🎉",
//                 text: `A new student account for ${registrationData.name} (${registrationData.hostelId}) has been created successfully. Temporary Password: ${registrationData.tempPassword}. The student will be forced to change this password upon first login.`,
//                 type: "success"
//             });
//             setIsMessageVisible(true);

//             // 3. Auto-hide message and force view back to register-user
//             setTimeout(() => {
//                 setIsMessageVisible(false);
//             }, 5000);
            
//             setTimeout(() => {
//                 handleViewChange('register-user');
//             }, 100);
//         } else if (!isStarting && status === 'error') {
//             // Re-enable auth listener after failed attempt
//             setLastWardenHash(null);
//             console.log("Registration failed, resetting warden hash.");
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

//     // Auth State Listener and Routing Enforcement
//     useEffect(() => {
//         const unsubscribe = onAuthStateChanged(auth, async (user) => {
            
//             // CRITICAL LOCK: If a registration sequence is active, ignore all transient changes.
//             if (isRegistering) {
//                 console.log("🔒 DEBUG: Ignoring transient auth state change during registration.");
//                 return;
//             }
            
//             if (user) {
//                 try {
//                     const userData = await fetchUserRole(user.uid, user.email);

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
//                         userData: userData.userData
//                     }));

//                     const currentHash = window.location.hash.replace(/^#\/?/, '');
//                     console.log("🔧 DEBUG: Auth state change - Current hash:", currentHash, "Role:", userData.role);

//                     // 1. Warden was on register page and session was restored -> Force back to register
//                     if (userData.role === 'warden' && lastWardenHash === 'register-user') {
//                         handleViewChange('register-user');
//                         return;
//                     }

//                     // 2. Critical Mandatory Change Gate (Student only)
//                     if (userData.mustChangePassword && userData.role === 'student') {
//                         handleViewChange('change-password');
//                         return;
//                     }

//                     // 3. Redirect away from public pages to dashboard
//                     if (currentHash === 'login' || currentHash === 'password-recovery') {
//                         handleViewChange(userData.role);
//                         return;
//                     }

//                     // 4. Default: If authenticated but no specific view, go to role-based dashboard
//                     if (!currentHash || currentHash === '') {
//                         handleViewChange(userData.role);
//                     }

//                 } catch (error) {
//                     console.error("Error in auth state change:", error);
//                     await signOut(auth);
//                     setAppState(prev => ({
//                         ...initialUserState,
//                         loading: false,
//                         isAuthReady: true,
//                         error: "Failed to load user data, please log in again."
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
//                 setLastWardenHash(null); // Reset warden hash tracking
//                 handleViewChange(getInitialView());
//             }
//         });

//         return () => unsubscribe();
//     }, [isRegistering, lastWardenHash]); // Added dependencies

//     // initial load / refresh user data from Firestore
//     useEffect(() => {
//         const fetchUser = async () => {
//             if (auth.currentUser) {
//                 try {
//                     const doc = await getUserFromFirestore(auth.currentUser.uid);
//                     setAppState(prev => ({
//                         ...prev,
//                         userData: doc || null
//                     }));
//                 } catch (err) {
//                     console.warn('Failed to load user data', err);
//                 }
//             }
//         };
//         fetchUser();
//     }, []);

//     // feedback fetching
//     useEffect(() => {
//         const fetchFeedbacks = async () => {
//         try {
//             const querySnapshot = await getDocs(collection(db, "feedbacks"));
//             const data = querySnapshot.docs.map((doc) => ({
//             id: doc.id,
//             ...doc.data(),
//             }));
//             setFeedbackList(data);
//         } catch (error) {
//             console.error("Error fetching feedbacks: ", error);
//         }
//         };

//         fetchFeedbacks();
//     }, []);

//     const handleProfileUpdate = (updatedUserDataFromChild) => {
//         console.log("APP_STATE: Profile data is being updated globally.", updatedUserDataFromChild);
//         setAppState(prev => ({
//             ...prev,
//             // Replace the old userData with the new, updated object
//             userData: updatedUserDataFromChild
//         }));
//     };

//     const handleLoginSuccess = ({ role, userDocId, mustChange, userData }) => {
//         setAppState(prev => ({
//             ...prev,
//             role: role,
//             userId: auth.currentUser.uid,
//             userDocId: userDocId,
//             isAuthenticated: true,
//             isAuthReady: true,
//             mustChangePassword: mustChange,
//             forceMandatoryChange: mustChange,
//             userData: userData
//         }));

//         // CRITICAL: Check for mandatory change immediately after login
//         if (mustChange && role === 'student') {
//             handleViewChange('change-password');
//         } else {
//             handleViewChange(role);
//         }
//     };

//     const handleForcedPasswordChangeComplete = () => {
//         setAppState(prev => ({
//             ...prev,
//             mustChangePassword: false,
//             forceMandatoryChange: false
//         }));
//         handleViewChange(appState.role);
//     };

//     const handleLogout = async () => {
//         try {
//             // Clear cached warden credentials
//             wardenSessionCache.email = null;
//             wardenSessionCache.password = null;
//             setLastWardenHash(null);
//             await signOut(auth);
//         } catch (error) {
//             console.error("Logout error:", error);
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

//     const handleUpdateComplaint = (id, updates) => {
//         setComplaints(prev => prev.map(c => c._id === id ? { ...c, ...updates } : c));
//     };

//     // Feedback handlers
//     const handleFeedbackSubmit = async (feedback) => {
//         try {
//         if (editingFeedback) {
//             // Update existing feedback
//             const feedbackRef = doc(db, "feedbacks", feedback.id.toString());
//             await updateDoc(feedbackRef, feedback);
//             setFeedbackList((prev) => prev.map((f) => (f.id === feedback.id ? feedback : f)));
//             setEditingFeedback(null);
//         } else {
//             // Add new feedback
//             const docRef = await addDoc(collection(db, "feedbacks"), feedback);
//             setFeedbackList((prev) => [...prev, { ...feedback, id: docRef.id }]);
//         }
//         handleViewChange("studentFeedbackList");
//         } catch (error) {
//         console.error("Error adding feedback: ", error);
//         }
//     };

//     const handleDeleteFeedback = async (id) => {
//         try {
//         await deleteDoc(doc(db, "feedbacks", id.toString()));
//         setFeedbackList((prev) => prev.filter((f) => f.id !== id));
//         } catch (error) {
//         console.error("Error deleting feedback: ", error);
//         }
//     };

//     const handleEditFeedback = (feedback) => {
//         setEditingFeedback(feedback);
//         handleViewChange("feedbackForm");
//     };

//     const handleCancelEdit = () => {
//         setEditingFeedback(null);
//         handleViewChange("studentFeedbackList");
//     };

//     const handleMarkReviewed = async (id) => {
//         try {
//         const feedbackRef = doc(db, "feedbacks", id);
//         await updateDoc(feedbackRef, { reviewed: true }); // update Firestore

//         // update UI locally too
//         setFeedbackList((prev) =>
//             prev.map((f) =>
//             f.id === id ? { ...f, reviewed: true } : f
//             )
//         );
//         } catch (error) {
//         console.error("Error marking feedback as reviewed: ", error);
//         }
//     };

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
//                 </div>
//             );
//         }

//         if (!appState.isAuthenticated) {
//             switch (view) {
//                 case "password-recovery":
//                     return <PasswordRecoveryPage onBackToLogin={handleBackToLogin} />;
//                 case "login":
//                 default:
//                     return <LoginPage onLoginSuccess={handleLoginSuccess} onForgotPassword={handleForgotPasswordClick} />;
//             }
//         }

//         // Mandatory Password Change Gate (Forces student users)
//         if (appState.forceMandatoryChange && appState.role === 'student') {
//             if (view !== 'change-password') {
//                 handleViewChange('change-password');
//             }
//             return <ChangePasswordPage
//                       onForcedPasswordChangeComplete={handleForcedPasswordChangeComplete}
//                       userId={appState.userId}
//                       userDocId={appState.userDocId}
//                       userRole={appState.role}
//                       isVoluntary={false}
//                       onCancel={null}
//                     />;
//         }
        
//         // Authenticated User Routing
//         switch (view) {
//             case "student":
//                 return <StudentDashboard
//                 onLogout={handleLogout}
//                 userId={appState.userId}
//                 userDocId={appState.userDocId}
//                 userRole={appState.role}
//                 onViewChange={handleViewChange}
//                 />;

//             case "warden":
//                 return <WardenDashboard
//                 onLogout={handleLogout}
//                 userId={appState.userId}
//                 userDocId={appState.userDocId}
//                 userRole={appState.role}
//                 onViewChange={handleViewChange}
//                 />;

//             case "register-user":
//                 if (appState.role === 'warden') {
//                     return <RegisterUserPage
//                     onBackToDashboard={() => handleViewChange('warden')}
//                     onRegistrationComplete={handleRegistrationComplete}
//                     />;
//                 } 
//                 // Fallback for unauthorized access
//                 return handleViewChange(appState.role); 

//             case "profile-management":
//                 return <ProfileManagementPage
//                         appState={appState}
//                         onBackToDashboard={() => handleViewChange(appState.role)}
//                         onPasswordChange={() => handleViewChange('change-password-voluntary')}
//                         onProfileUpdated={handleProfileUpdate}
//                     />;

//             case "change-password-voluntary":
//                 return <ChangePasswordPage
//                         onForcedPasswordChangeComplete={() => handleViewChange('profile-management')}
//                         userId={appState.userId}
//                         userDocId={appState.userDocId}
//                         userRole={appState.role}
//                         isVoluntary={true}
//                         onCancel={() => handleViewChange('profile-management')}
//                     />;

//             case "complaintForm":
//                 return <ComplaintForm
//                             currentUser={appState.userData}
//                             onCreate={handleCreateComplaint}
//                             onClose={() => handleViewChange("student")}
//                     />;

//             case "complaintList":
//                 return <ComplaintList 
//                             list={complaints}
//                             filter={{ userId: appState.userData.userId }}
//                             onSelect={c=> { setSelected(c); handleViewChange("complaintDetail"); }}
//                             onBack={() => handleViewChange(appState.role)}
//                         />;
                    
//             case "complaintDetail":
//                 return <ComplaintDetail
//                             complaint={selected}
//                             currentUser={appState.userData}
//                             onClose={() => handleViewChange("complaintList")}
//                             onUpdate={handleUpdateComplaint}
//                             onGiveFeedback={() => handleViewChange("feedbackForm")}
//                     />;
            
//             case "feedbackForm":
//                 return <FeedbackForm
//                     onBack={() => handleViewChange("student")}
//                     onSubmitFeedback={handleFeedbackSubmit}
//                     editingFeedback={editingFeedback}
//                     onCancelEdit={handleCancelEdit}
//                 />

//             case "feedbackViewer":
//                 return <FeedbackViewer
//                     feedbackList={feedbackList}
//                     onBack={() => handleViewChange("warden")}
//                     onMarkReviewed={handleMarkReviewed}
//                 />

//             case "studentFeedbackList":
//                 return<FeedbackList
//                         feedbackList={feedbackList}
//                         onBack={() => handleViewChange("student")}
//                         onDeleteFeedback={handleDeleteFeedback}
//                         onEditFeedback={handleEditFeedback}
//                 />
    
//             default:
//                 // Fallback to dashboard based on role
//                 return handleViewChange(appState.role);
//         }
//     };

//     return (
//         <div className="min-h-screen font-sans bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
//             {/* GLOBAL MESSAGE BOX */}
//             {isMessageVisible && (
//                 <MessageBox title={message.title} text={message.text} type={message.type} onClose={closeMessage} />
//             )}
//             {renderView()}
//         </div>
//     );
// };

// export default App;
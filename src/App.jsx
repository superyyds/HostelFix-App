import React, { useState, useEffect } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc } from "firebase/firestore";

// --- Import UI Component ---
// Only the global MessageBox is needed here for displaying messages system-wide.
import MessageBox from './components/MessageBox';
import PrimaryButton from './components/PrimaryButton';

// --- Import API / Firebase Helpers ---
import { 
    db,
    auth, 
    signOut, 
    fetchUserRole, 
    wardenSessionCache,
    onAuthStateChanged,
} from './api/firebase';

// User Managemnent Module Components
import LoginPage from './pages/LoginPage';
import PasswordRecoveryPage from './pages/PasswordRecoveryPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import RegisterUserPage from './pages/RegisterUserPage';
import StudentDashboard from './pages/StudentDashboard';
import WardenDashboard from './pages/WardenDashboard';
import ProfileManagementPage from './pages/ProfileManagementPage';

// import Complaint Management Module Components
import ComplaintForm from './pages/ComplaintForm';
import ComplaintList from './pages/ComplaintList';
import ComplaintDetail from './pages/ComplaintDetail';

// impoart Feedback Module Components
import FeedbackForm from './pages/FeedbackForm';
import FeedbackList from './pages/FeedbackList';
import FeedbackViewer from './pages/FeedbackViewer';

// --- Global State Structure ---
const initialUserState = {
    userId: null,
    userDocId: null,
    role: null,
    loading: false,
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
    const [isMessageVisible, setIsMessageVisible] = useState(false);
    const [message, setMessage] = useState({ title: "", text: "", type: "" });

    // complaint + feedback
    const [complaints, setComplaints] = useState([]);
    const [selected, setSelected] = useState(null);
    const [feedbackList, setFeedbackList] = useState([]);
    const [editingFeedback, setEditingFeedback] = useState(null); // NEW: track feedback being edited

    const closeMessage = () => setIsMessageVisible(false);

    // Helper to determine initial view from URL hash
    const getInitialView = () => {
        const hash = window.location.hash.replace(/^#\/?/, '');
        const publicViews = ['password-recovery', 'login', 'change-password'];
        
        if (publicViews.includes(hash)) {
            return hash;
        }

        if (hash && hash !== 'login') {
            window.location.hash = '/login';
        }

        return 'login';
    };

    const [view, setView] = useState(getInitialView());

    // Handles view changes and updates URL hash
    const handleViewChange = (newView) => {
        if (view !== newView) {
            setView(newView);
            window.location.hash = `/${newView}`;
            
            // Track when warden navigates to register page
            if (newView === 'register-user' && appState.role === 'warden') {
                setLastWardenHash('register-user');
            }
        }
    };
    
    // Function to manage the state and view after registration completes
    const handleRegistrationComplete = (isStarting, status = null, registrationData = null) => {
        // 1. Set the global flag to lock/unlock the onAuthStateChanged listener
        setIsRegistering(isStarting);

        if (!isStarting && status === 'success') {
            // 2. Show success message
            setMessage({
                title: "Account Created! 🎉",
                text: `A new student account for ${registrationData.name} (${registrationData.hostelId}) has been created successfully. Temporary Password: ${registrationData.tempPassword}. The student will be forced to change this password upon first login.`,
                type: "success"
            });
            setIsMessageVisible(true);

            // 3. Auto-hide message and force view back to register-user
            setTimeout(() => {
                setIsMessageVisible(false);
            }, 5000);
            
            setTimeout(() => {
                handleViewChange('register-user');
            }, 100);
        } else if (!isStarting && status === 'error') {
            // Re-enable auth listener after failed attempt
            setLastWardenHash(null);
            console.log("Registration failed, resetting warden hash.");
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

    // Auth State Listener and Routing Enforcement
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            
            // CRITICAL LOCK: If a registration sequence is active, ignore all transient changes.
            if (isRegistering) {
                console.log("🔒 DEBUG: Ignoring transient auth state change during registration.");
                return;
            }
            
            if (user) {
                try {
                    const userData = await fetchUserRole(user.uid, user.email);

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
                        userData: userData.userData
                    }));

                    const currentHash = window.location.hash.replace(/^#\/?/, '');
                    console.log("🔧 DEBUG: Auth state change - Current hash:", currentHash, "Role:", userData.role);

                    // 1. Warden was on register page and session was restored -> Force back to register
                    if (userData.role === 'warden' && lastWardenHash === 'register-user') {
                        handleViewChange('register-user');
                        return;
                    }

                    // 2. Critical Mandatory Change Gate (Student only)
                    if (userData.mustChangePassword && userData.role === 'student') {
                        handleViewChange('change-password');
                        return;
                    }

                    // 3. Redirect away from public pages to dashboard
                    if (currentHash === 'login' || currentHash === 'password-recovery') {
                        handleViewChange(userData.role);
                        return;
                    }

                    // 4. Default: If authenticated but no specific view, go to role-based dashboard
                    if (!currentHash || currentHash === '') {
                        handleViewChange(userData.role);
                    }

                } catch (error) {
                    console.error("Error in auth state change:", error);
                    await signOut(auth);
                    setAppState(prev => ({
                        ...initialUserState,
                        loading: false,
                        isAuthReady: true,
                        error: "Failed to load user data, please log in again."
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
                setLastWardenHash(null); // Reset warden hash tracking
                handleViewChange(getInitialView());
            }
        });

        return () => unsubscribe();
    }, [isRegistering, lastWardenHash]); // Added dependencies

    // feedback fetching
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

    const handleLoginSuccess = ({ role, userDocId, mustChange, userData }) => {
        setAppState(prev => ({
            ...prev,
            role: role,
            userId: auth.currentUser.uid,
            userDocId: userDocId,
            isAuthenticated: true,
            isAuthReady: true,
            mustChangePassword: mustChange,
            forceMandatoryChange: mustChange,
            userData: userData
        }));

        // CRITICAL: Check for mandatory change immediately after login
        if (mustChange && role === 'student') {
            handleViewChange('change-password');
        } else {
            handleViewChange(role);
        }
    };

    const handleForcedPasswordChangeComplete = () => {
        setAppState(prev => ({
            ...prev,
            mustChangePassword: false,
            forceMandatoryChange: false
        }));
        handleViewChange(appState.role);
    };

    const handleLogout = async () => {
        try {
            // Clear cached warden credentials
            wardenSessionCache.email = null;
            wardenSessionCache.password = null;
            setLastWardenHash(null);
            await signOut(auth);
        } catch (error) {
            console.error("Logout error:", error);
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

    const handleUpdateComplaint = (id, updates) => {
        setComplaints(prev => prev.map(c => c._id === id ? { ...c, ...updates } : c));
    };

    // --- Feedback Functions ---
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
        const feedbackRef = doc(db, "feedbacks", id);
        await updateDoc(feedbackRef, { reviewed: true }); // update Firestore

        // update UI locally too
        setFeedbackList((prev) =>
            prev.map((f) =>
            f.id === id ? { ...f, reviewed: true } : f
            )
        );
        } catch (error) {
        console.error("Error marking feedback as reviewed: ", error);
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
                </div>
            );
        }

        if (!appState.isAuthenticated) {
            switch (view) {
                case "password-recovery":
                    return <PasswordRecoveryPage onBackToLogin={handleBackToLogin} />;
                case "login":
                default:
                    return <LoginPage onLoginSuccess={handleLoginSuccess} onForgotPassword={handleForgotPasswordClick} />;
            }
        }

        // Mandatory Password Change Gate (Forces student users)
        if (appState.forceMandatoryChange && appState.role === 'student') {
            if (view !== 'change-password') {
                handleViewChange('change-password');
            }
            return <ChangePasswordPage
                      onForcedPasswordChangeComplete={handleForcedPasswordChangeComplete}
                      userId={appState.userId}
                      userDocId={appState.userDocId}
                      userRole={appState.role}
                      isVoluntary={false}
                      onCancel={null}
                    />;
        }
        
        // Authenticated User Routing
        switch (view) {
            case "student":
                return <StudentDashboard
                onLogout={handleLogout}
                userId={appState.userId}
                userDocId={appState.userDocId}
                userRole={appState.role}
                onViewChange={handleViewChange}
                />;

            case "warden":
                return <WardenDashboard
                onLogout={handleLogout}
                userId={appState.userId}
                userDocId={appState.userDocId}
                userRole={appState.role}
                onViewChange={handleViewChange}
                />;

            case "register-user":
                if (appState.role === 'warden') {
                    return <RegisterUserPage
                    onBackToDashboard={() => handleViewChange('warden')}
                    onRegistrationComplete={handleRegistrationComplete}
                    />;
                } 
                // Fallback for unauthorized access
                return handleViewChange(appState.role); 

            case "profile-management":
                return <ProfileManagementPage
                        appState={appState}
                        onBackToDashboard={() => handleViewChange(appState.role)}
                        onPasswordChange={() => handleViewChange('change-password-voluntary')}
                    />;

            case "change-password-voluntary":
                return <ChangePasswordPage
                        onForcedPasswordChangeComplete={() => handleViewChange('profile-management')}
                        userId={appState.userId}
                        userDocId={appState.userDocId}
                        userRole={appState.role}
                        isVoluntary={true}
                        onCancel={() => handleViewChange('profile-management')}
                    />;

            case "complaintForm":
                return <ComplaintForm
                            currentUser={appState.userData}
                            onCreate={handleCreateComplaint}
                            onClose={() => handleViewChange("student")}
                    />;

            case "complaintList":
                return <ComplaintList 
                            list={complaints}
                            filter={{ userId: appState.userData.userId }}
                            onSelect={c=> { setSelected(c); handleViewChange("complaintDetail"); }}
                            onBack={() => handleViewChange(appState.role)}
                        />;
                    
            case "complaintDetail":
                return <ComplaintDetail
                            complaint={selected}
                            currentUser={appState.userData}
                            onClose={() => handleViewChange("complaintList")}
                            onUpdate={handleUpdateComplaint}
                            onGiveFeedback={() => handleViewChange("feedbackForm")}
                    />;
            
            case "feedbackForm":
                return <FeedbackForm
                    onBack={() => handleViewChange("student")}
                    onSubmitFeedback={handleFeedbackSubmit}
                    editingFeedback={editingFeedback}
                    onCancelEdit={handleCancelEdit}
                />

            case "feedbackViewer":
                return <FeedbackViewer
                    feedbackList={feedbackList}
                    onBack={() => handleViewChange("warden")}
                    onMarkReviewed={handleMarkReviewed}
                />

            case "studentFeedbackList":
                return<FeedbackList
                        feedbackList={feedbackList}
                        onBack={() => handleViewChange("student")}
                        onDeleteFeedback={handleDeleteFeedback}
                        onEditFeedback={handleEditFeedback}
                />
    
            default:
                // Fallback to dashboard based on role
                return handleViewChange(appState.role);
        }
    };

    return (
        <div className="min-h-screen font-sans bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
            {/* GLOBAL MESSAGE BOX */}
            {isMessageVisible && (
                <MessageBox title={message.title} text={message.text} type={message.type} onClose={closeMessage} />
            )}
            {renderView()}
        </div>
    );
};

export default App;
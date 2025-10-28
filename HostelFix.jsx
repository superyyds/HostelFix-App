import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { setLogLevel } from 'firebase/firestore';

// --- Global Variables (Mandatory for Canvas Environment) ---
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Utility to generate a unique ID if auth fails
const generateLocalUserId = () => `anon-${Math.random().toString(36).substring(2, 9)}`;

// --- UI Component: Status Badge ---
const StatusBadge = ({ status }) => {
    let color = '';
    switch (status) {
        case 'Pending':
            color = 'bg-yellow-500 text-yellow-900 ring-yellow-300';
            break;
        case 'In Progress':
            color = 'bg-blue-500 text-blue-900 ring-blue-300';
            break;
        case 'Resolved':
            color = 'bg-green-500 text-green-900 ring-green-300';
            break;
        default:
            color = 'bg-gray-400 text-gray-800 ring-gray-300';
    }
    return <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold shadow-sm ring-1 ring-inset ${color}`}>{status}</span>;
};

// --- Screen Component: Login Screen ---
const LoginScreen = ({ onLogin }) => {
    const [role, setRole] = useState('Student');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');

    const STUDENT_EMAIL = 'student@hostel.edu';
    const WARDEN_EMAIL = 'warden@hostel.edu';
    const ANY_PASSWORD = 'password';

    const handleLogin = (e) => {
        e.preventDefault();
        setMessage('');

        // --- Simulated Authentication Check ---
        if (password !== ANY_PASSWORD) {
            setMessage('Error: Incorrect password. Use "password"');
            return;
        }

        if (role === 'Student' && email === STUDENT_EMAIL) {
            setMessage('Signing in as Student...');
            setTimeout(() => onLogin('Student'), 500);
        } else if (role === 'Warden' && email === WARDEN_EMAIL) {
            setMessage('Signing in as Warden...');
            setTimeout(() => onLogin('Warden'), 500);
        } else {
            const expectedEmail = role === 'Student' ? STUDENT_EMAIL : WARDEN_EMAIL;
            setMessage(`Error: Incorrect email for ${role}. Use: ${expectedEmail}`);
        }
    };

    const handleRoleChange = (newRole) => {
        setRole(newRole);
        // Pre-fill email for easier testing
        setEmail(newRole === 'Student' ? STUDENT_EMAIL : WARDEN_EMAIL);
        setPassword(ANY_PASSWORD);
        setMessage('');
    }

    return (
        <div className="flex items-center justify-center min-h-[80vh]">
            <div className="bg-white p-10 rounded-2xl shadow-2xl w-full max-w-sm border-t-4 border-teal-500">
                <h2 className="text-3xl font-extrabold text-slate-800 mb-6 text-center">HostelFix Login</h2>
                <p className="text-sm text-gray-500 mb-6 text-center">Use the predefined credentials to test roles.</p>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Select Account Type</label>
                        <div className="bg-gray-200 p-1 rounded-lg flex space-x-1 shadow-inner">
                            <button
                                type="button"
                                onClick={() => handleRoleChange('Student')}
                                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-300 ${
                                    role === 'Student'
                                        ? 'bg-teal-600 text-white shadow-md'
                                        : 'bg-transparent text-gray-700 hover:bg-white'
                                }`}
                            >
                                Student
                            </button>
                            <button
                                type="button"
                                onClick={() => handleRoleChange('Warden')}
                                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-300 ${
                                    role === 'Warden'
                                        ? 'bg-teal-600 text-white shadow-md'
                                        : 'bg-transparent text-gray-700 hover:bg-white'
                                }`}
                            >
                                Warden / Staff
                            </button>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <input 
                            type="email" 
                            placeholder="Email Address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-teal-500 focus:border-teal-500 shadow-sm"
                            required
                        />
                        <input 
                            type="password" 
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-teal-500 focus:border-teal-500 shadow-sm"
                            required
                        />
                         <p className="text-xs text-gray-500 text-center">
                            **Student Email:** `{STUDENT_EMAIL}` | **Warden Email:** `{WARDEN_EMAIL}` | **Password:** `{ANY_PASSWORD}`
                        </p>
                    </div>
                    
                    <button
                        type="submit"
                        className="w-full bg-slate-700 text-white py-3 rounded-xl font-bold text-lg hover:bg-slate-800 transition duration-300 shadow-md transform hover:scale-[1.01]"
                    >
                        Sign In as {role}
                    </button>
                </form>

                {message && (
                    <p className={`mt-4 text-center text-sm font-medium ${message.startsWith('Error') ? 'text-red-500' : 'text-teal-600'}`}>{message}</p>
                )}
            </div>
        </div>
    );
};

// --- Screen Component: Dashboard Screen (Contains Complaint Form/List and Navigation) ---
const DashboardScreen = ({ userId, userRole, complaints, addComplaint, updateComplaintStatus, setModalComplaint, modalComplaint, onLogout }) => {
    
    const [currentTab, setCurrentTab] = useState('Complaints');

    const tabs = userRole === 'Student'
        ? ['Complaints', 'Feedback', 'Announcements']
        : ['Complaints', 'Feedback', 'Reports']; // Warden has Reports instead of Announcements

    // --- UI Component: Complaint Form ---
    const ComplaintForm = ({ onSubmit }) => {
        const [category, setCategory] = useState('Plumbing');
        const [description, setDescription] = useState('');
        const [priority, setPriority] = useState('Medium');
        const [isSubmitting, setIsSubmitting] = useState(false);
        const [message, setMessage] = useState('');

        const categories = ['Plumbing', 'Electrical', 'Furniture', 'Pest Control', 'Cleanliness', 'Other'];
        const priorities = ['Low', 'Medium', 'High', 'Urgent'];

        const handleSubmit = async (e) => {
            e.preventDefault();
            if (!description.trim()) {
                setMessage({ type: 'error', text: 'Description is required.' });
                return;
            }

            setIsSubmitting(true);
            setMessage({});

            const result = await onSubmit({ category, description, priority });

            if (result.success) {
                setMessage({ type: 'success', text: 'Complaint submitted successfully! You can track its status below.' });
                setDescription('');
                setPriority('Medium');
            } else {
                setMessage({ type: 'error', text: `Submission failed: ${result.error}` });
            }
            setIsSubmitting(false);
        };

        return (
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-lg mx-auto transform transition duration-300 hover:shadow-2xl">
                <h2 className="text-2xl font-extrabold mb-6 text-slate-800 border-b pb-2">Report a Faulty Facility</h2>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Facility Category</label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-teal-500 focus:border-teal-500 transition duration-150 ease-in-out shadow-sm"
                            required
                        >
                            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Urgency / Priority</label>
                        <select
                            value={priority}
                            onChange={(e) => setPriority(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-teal-500 focus:border-teal-500 transition duration-150 ease-in-out shadow-sm"
                            required
                        >
                            {priorities.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Detailed Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows="4"
                            className="w-full border border-gray-300 rounded-lg p-3 resize-none focus:ring-teal-500 focus:border-teal-500 transition duration-150 ease-in-out shadow-sm"
                            placeholder="Specify location (Block/Room) and describe the issue clearly (e.g., Water leakage in Block A, Room 305 ceiling)."
                            required
                        ></textarea>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-teal-600 text-white py-3 rounded-xl font-bold text-lg hover:bg-teal-700 transition duration-300 ease-in-out disabled:bg-teal-300 shadow-md hover:shadow-lg transform hover:scale-[1.01]"
                    >
                        {isSubmitting ? 'Submitting...' : 'Submit Maintenance Request'}
                    </button>
                </form>

                {message.text && (
                    <div className={`mt-5 p-3 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-green-100 text-green-800 border-l-4 border-green-500' : 'bg-red-100 text-red-800 border-l-4 border-red-500'}`}>
                        {message.text}
                    </div>
                )}
            </div>
        );
    };

    // --- UI Component: Resolution Modal ---
    const ResolutionModal = ({ complaint, onResolve, onCancel }) => {
        const [remark, setRemark] = useState('');
        const [isResolving, setIsResolving] = useState(false);

        const handleResolve = async () => {
            if (!remark.trim()) {
                document.getElementById('modal-message').textContent = "Resolution remark is required to mark as Resolved.";
                return;
            }
            setIsResolving(true);
            await onResolve(complaint.id, 'Resolved', remark);
            setIsResolving(false);
        };

        return (
            <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md transform scale-100 transition-all duration-300">
                    <div className="p-6 border-b border-gray-100 bg-teal-50 rounded-t-2xl">
                        <h3 className="text-xl font-bold text-teal-800 flex items-center">
                            <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            Confirm Resolution
                        </h3>
                    </div>
                    <div className="p-6 space-y-4">
                        <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border">
                            **ID:** {complaint.id.substring(0, 8)} | **Category:** <span className="font-semibold text-teal-700">{complaint.category}</span>
                            <br/>
                            **Original Issue:** {complaint.description}
                        </p>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Resolution Remark / Proof of Fix</label>
                        <textarea
                            value={remark}
                            onChange={(e) => setRemark(e.target.value)}
                            rows="4"
                            placeholder="Describe the action taken (e.g., Replaced faulty component, tested, and verified fix). This remark is public."
                            className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-green-500 focus:border-green-500 resize-none shadow-sm"
                        ></textarea>
                        <p id="modal-message" className="text-red-500 text-sm font-medium"></p>
                    </div>
                    <div className="p-4 border-t border-gray-100 flex justify-end space-x-3 rounded-b-2xl bg-gray-50">
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 text-sm rounded-xl bg-gray-300 text-gray-800 hover:bg-gray-400 transition-colors font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleResolve}
                            disabled={isResolving}
                            className="px-4 py-2 text-sm rounded-xl bg-green-600 text-white hover:bg-green-700 transition-colors disabled:bg-green-300 font-medium shadow-md"
                        >
                            {isResolving ? 'Finalizing...' : 'Mark as Resolved'}
                        </button>
                    </div>
                </div>
            </div>
        );
    };


    // --- UI Component: Complaint List ---
    const ComplaintList = ({ data, onUpdateStatus, role }) => {
        const myComplaints = role === 'Student'
            ? data.filter(c => c.userId === userId)
            : data;

        const isManager = role === 'Warden';

        if (myComplaints.length === 0) {
            return (
                <div className="text-center p-12 bg-white rounded-2xl shadow-xl w-full max-w-4xl mx-auto border-t-4 border-gray-200">
                    <p className="text-gray-500 font-medium">
                        {role === 'Student' ? "You currently have no submitted complaints. Ready to report an issue?" : "No active or resolved complaints found in the system."}
                    </p>
                </div>
            );
        }

        const handleStatusClick = (complaint, newStatus) => {
            if (!isManager) return;
            
            if (newStatus === 'Resolved') {
                setModalComplaint(complaint);
            } else {
                onUpdateStatus(complaint.id, newStatus);
            }
        };

        return (
            <div className="space-y-4 w-full max-w-4xl mx-auto">
                <h2 className="text-2xl font-extrabold text-slate-800 mb-6 border-b pb-2">
                    {role === 'Student' ? 'My Complaint Tracking & History' : 'Maintenance Management Queue'}
                </h2>
                {myComplaints.map((c) => {
                    const isResolved = c.status === 'Resolved';
                    const priorityColor = c.priority === 'Urgent' ? 'border-red-500' : (c.priority === 'High' ? 'border-orange-500' : 'border-teal-500');

                    return (
                        <div key={c.id} className={`bg-white p-6 rounded-xl shadow-lg border-l-4 ${priorityColor} transition duration-200 hover:shadow-xl`}>
                            <div className="flex justify-between items-start mb-3">
                                <h3 className="text-xl font-bold text-gray-900 flex flex-col md:flex-row md:items-center">
                                    <span className="text-teal-700">{c.category}</span>
                                    <span className="text-sm font-normal text-gray-500 ml-0 md:ml-3">ID: {c.id.substring(0, 8)}</span>
                                </h3>
                                <StatusBadge status={c.status} />
                            </div>
                            
                            <p className="text-gray-700 text-base mb-4 border-b pb-4">{c.description}</p>
                            
                            {/* Metadata Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm text-gray-600">
                                <div className="flex flex-col">
                                    <span className="font-semibold text-gray-800">Priority</span>
                                    <span className={`font-bold ${c.priority === 'Urgent' ? 'text-red-600' : 'text-teal-600'}`}>{c.priority}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-semibold text-gray-800">Reported</span>
                                    <span>{c.dateSubmitted.split(',')[0]}</span>
                                </div>
                                {isResolved && c.dateResolved && (
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-gray-800">Resolved On</span>
                                        <span className="text-green-600 font-medium">{c.dateResolved.split(',')[0]}</span>
                                    </div>
                                )}
                                {isManager && (
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-gray-800">Reporter</span>
                                        <span>{c.userId.substring(0, 8)}...</span>
                                    </div>
                                )}
                            </div>

                            {/* Display Resolution Remark */}
                            {isResolved && c.resolutionRemark && (
                                <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm border-l-4 border-green-500 shadow-inner">
                                    <span className="font-bold text-green-700 block mb-1">Resolution Summary:</span> 
                                    {c.resolutionRemark}
                                </div>
                            )}

                            {/* Warden Action Buttons */}
                            {isManager && (
                                <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-2 justify-end">
                                    {['Pending', 'In Progress', 'Resolved'].map(status => (
                                        <button
                                            key={status}
                                            onClick={() => handleStatusClick(c, status)}
                                            disabled={c.status === status}
                                            className={`px-4 py-1 text-sm rounded-lg font-medium transition-colors shadow-sm ${
                                                c.status === status
                                                    ? 'bg-slate-700 text-white shadow-md'
                                                    : 'bg-teal-100 text-teal-700 hover:bg-teal-200 disabled:opacity-50'
                                            }`}
                                        >
                                            {status}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };
    
    // --- UI Component: Placeholder Pages ---
    const PlaceholderContent = ({ title, description }) => (
        <div className="p-12 bg-white rounded-2xl shadow-xl w-full max-w-4xl mx-auto border-t-4 border-teal-500 text-center">
            <h2 className="text-3xl font-bold text-slate-800 mb-4">{title}</h2>
            <p className="text-gray-600 text-lg">
                {description}
            </p>
            <p className="mt-4 text-sm text-gray-500">
                *(Feature pending implementation by the team)*
            </p>
        </div>
    );

    // --- Main Dashboard Render Logic ---
    const renderContent = () => {
        switch (currentTab) {
            case 'Complaints':
                return (
                    <div className="space-y-10">
                        {userRole === 'Student' && <ComplaintForm onSubmit={addComplaint} />}
                        <ComplaintList
                            data={complaints}
                            onUpdateStatus={updateComplaintStatus}
                            role={userRole}
                        />
                    </div>
                );
            case 'Feedback':
                return (
                    <PlaceholderContent
                        title="Feedback Management (Module 3)"
                        description="This section will allow students to rate and comment on resolved complaints and enable wardens to view satisfaction levels."
                    />
                );
            case 'Announcements': // Student View
                return (
                    <PlaceholderContent
                        title="Hostel Announcements"
                        description="View important updates and notices posted by the Warden/Admin staff."
                    />
                );
            case 'Reports': // Warden View
                return (
                    <PlaceholderContent
                        title="Reports and Analytics (Module 4)"
                        description="This section will provide dashboards for key metrics (e.g., Resolved Rate, Response Time) and allow report generation."
                    />
                );
            default:
                return <PlaceholderContent title="Welcome" description="Select a tab to begin." />;
        }
    };

    return (
        <div className="space-y-10">
            {/* Tab Navigation */}
            <div className="bg-white p-2 rounded-2xl shadow-lg w-full max-w-4xl mx-auto">
                <div className="flex justify-around space-x-2">
                    {tabs.map(tab => (
                        <button
                            key={tab}
                            onClick={() => setCurrentTab(tab)}
                            className={`flex-1 py-3 rounded-xl text-lg font-semibold transition-all duration-300 transform hover:scale-[1.02] ${
                                currentTab === tab
                                    ? 'bg-teal-600 text-white shadow-lg'
                                    : 'bg-transparent text-slate-700 hover:bg-teal-50'
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            {renderContent()}
            
            {/* Resolution Modal for Warden View (always at the root level of Dashboard) */}
            {modalComplaint && (
                <ResolutionModal 
                    complaint={modalComplaint}
                    onResolve={updateComplaintStatus}
                    onCancel={() => setModalComplaint(null)}
                />
            )}
        </div>
    );
};


// --- Core Application Component (App) ---
const App = () => {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [userRole, setUserRole] = useState(null); // null means not logged in
    const [isAuthReady, setIsAuthReady] = useState(false);

    // Core Data & State
    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [modalComplaint, setModalComplaint] = useState(null);

    // --- Firebase Initialization and Authentication ---
    useEffect(() => {
        setLogLevel('Debug');
        if (Object.keys(firebaseConfig).length === 0) {
            setError('Firebase configuration is missing. Cannot run app.');
            return;
        }

        try {
            const app = initializeApp(firebaseConfig);
            const dbInstance = getFirestore(app);
            const authInstance = getAuth(app);

            setDb(dbInstance);
            setAuth(authInstance);

            // Initial Anonymous sign-in for persistence
            const authenticateAnon = async () => {
                try {
                    if (initialAuthToken) {
                        const userCredential = await signInWithCustomToken(authInstance, initialAuthToken);
                        setUserId(userCredential.user.uid);
                    } else {
                        const anonUser = await signInAnonymously(authInstance);
                        setUserId(anonUser.user.uid);
                    }
                } catch (e) {
                    console.error("Firebase Auth failed:", e);
                    setUserId(generateLocalUserId());
                }
                setIsAuthReady(true);
                setLoading(false);
            };

            // Use onAuthStateChanged for robust persistence check
            const unsubscribe = onAuthStateChanged(authInstance, (user) => {
                // If user is null, and we haven't authenticated yet, run anon sign-in
                if (!user && !isAuthReady) {
                     authenticateAnon();
                } else if (user) {
                     setUserId(user.uid);
                     // If we are authenticated but haven't set isAuthReady, set it now.
                     if (!isAuthReady) {
                        setIsAuthReady(true);
                        setLoading(false);
                     }
                } else if (!user && isAuthReady) {
                    // User signed out, or failed to sign in after first check
                    setUserId(generateLocalUserId());
                }
            });

            return () => unsubscribe();
        } catch (e) {
            console.error("Firebase initialization error:", e);
            setError(`Firebase Init Failed: ${e.message}`);
            setLoading(false);
        }
    }, [isAuthReady]);


    // --- Firestore Data Listener (Complaint Tracking) ---
    useEffect(() => {
        if (!db || !isAuthReady) return;

        // Public collection path for multi-user visibility
        const complaintsCollectionPath = `/artifacts/${appId}/public/data/hostel_complaints`;
        const q = query(collection(db, complaintsCollectionPath));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedComplaints = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                // Convert Firestore Timestamp to Date for display (if available)
                dateSubmitted: doc.data().dateSubmitted ? doc.data().dateSubmitted.toDate().toLocaleString() : 'N/A',
                dateResolved: doc.data().dateResolved ? doc.data().dateResolved.toDate().toLocaleString() : null
            }));
            // Sort in memory (newest first)
            fetchedComplaints.sort((a, b) => new Date(b.dateSubmitted) - new Date(a.dateSubmitted));

            setComplaints(fetchedComplaints);
        }, (err) => {
            console.error("Firestore snapshot failed:", err);
            setError("Failed to load real-time complaints.");
        });

        return () => unsubscribe();
    }, [db, isAuthReady]);

    // --- Handlers (passed down to DashboardScreen) ---

    // 2.1 Register Complaint (Student function)
    const addComplaint = useCallback(async (newComplaint) => {
        if (!db || !userId) {
            setError('System not ready or user ID missing.');
            return { success: false, error: 'System not ready.' };
        }

        const complaintsCollectionPath = `/artifacts/${appId}/public/data/hostel_complaints`;

        try {
            await setDoc(doc(collection(db, complaintsCollectionPath)), {
                userId: userId,
                category: newComplaint.category,
                description: newComplaint.description,
                priority: newComplaint.priority,
                status: 'Pending', // Initial status
                dateSubmitted: serverTimestamp(),
            });
            return { success: true };
        } catch (e) {
            console.error("Error adding document: ", e);
            setError("Failed to submit complaint. Check console for details.");
            return { success: false, error: e.message };
        }
    }, [db, userId, appId]);

    // 2.4 Complaint Resolution/Status Update (Warden/Staff function)
    const updateComplaintStatus = useCallback(async (complaintId, newStatus, remark = null) => {
        if (!db) {
            setError('Database not initialized.');
            return;
        }
        if (userRole !== 'Warden') return; // Enforce RBAC

        const complaintRefPath = `/artifacts/${appId}/public/data/hostel_complaints/${complaintId}`;

        try {
            const updateData = { status: newStatus };
            if (newStatus === 'Resolved') {
                updateData.dateResolved = serverTimestamp();
                updateData.resolutionRemark = remark || "No remark provided by staff.";
            } else {
                updateData.dateResolved = null;
                updateData.resolutionRemark = null;
            }

            await updateDoc(doc(db, complaintRefPath), updateData);
            setModalComplaint(null); // Close the resolution form
        } catch (e) {
            console.error("Error updating status: ", e);
            setError("Failed to update complaint status.");
        }
    }, [db, userRole, appId]);
    
    // Login and Logout Logic
    const handleLogin = (role) => {
        setUserRole(role);
    };

    const handleLogout = () => {
        setUserRole(null);
        // In a real app, you would sign out the user here (signOut(auth)).
        // For simulation, resetting the role is enough.
    };


    const renderContent = () => {
        if (error) {
            return <div className="text-center p-6 bg-red-100 text-red-700 rounded-lg max-w-2xl mx-auto mt-10 shadow-lg">{error}</div>;
        }

        if (loading || !isAuthReady) {
            return <div className="text-center mt-20 text-teal-600 font-semibold text-lg">Loading system resources...</div>;
        }
        
        // --- Navigation Logic ---
        if (!userRole) {
            return <LoginScreen onLogin={handleLogin} />;
        }

        return (
            <DashboardScreen
                userId={userId}
                userRole={userRole}
                complaints={complaints}
                addComplaint={addComplaint}
                updateComplaintStatus={updateComplaintStatus}
                setModalComplaint={setModalComplaint}
                modalComplaint={modalComplaint}
                onLogout={handleLogout}
            />
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 font-sans antialiased">
            <header className="bg-white shadow-xl sticky top-0 z-10 border-b-4 border-teal-500">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row justify-between items-center">
                    <h1 className="text-3xl font-extrabold text-slate-800 flex items-center mb-3 md:mb-0">
                        <svg className="w-8 h-8 mr-3 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4h-3a2 2 0 100 4h3m-3 0a2 2 0 100 4h3m0-4v2m0-6h3a2 2 0 100 4h-3m0 0a2 2 0 100 4v2"></path></svg>
                        HostelFix Facility Management
                    </h1>

                    <div className="flex items-center space-x-4">
                        {userRole && userId && (
                            <div className="text-sm text-gray-500 hidden sm:block p-2 border rounded-lg bg-gray-100">
                                <span className="font-semibold text-gray-700">Client ID:</span> {userId}
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {renderContent()}

                <footer className="mt-16 pt-6 border-t border-gray-200 text-center text-xs text-gray-500">
                    <p>System Simulation | Powered by React and Firebase Firestore for real-time data persistence.</p>
                </footer>
            </main>
        </div>
    );
};

export default App;

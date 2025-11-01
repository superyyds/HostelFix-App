import React, { useState, useEffect } from "react";
import { LogIn, Home, Shield, AlertTriangle, MessageSquare, Briefcase, User, Mail, Users, Compass, Key, ArrowLeft, Loader2, BarChart3, Settings, LogOut, Lock, Plus, Contact, Phone, Info } from "lucide-react";
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, signOut, onAuthStateChanged } from 'firebase/auth';
// FIX: Removed firestore actions (getDocs, setDoc, etc.) to revert to simulation and avoid permission errors
import { getFirestore, doc } from 'firebase/firestore'; // Keep getFirestore for init, doc might be needed if we add it back

// --- Firebase Setup (MANDATORY) ---

// Get environment variables
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-hostelfix-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null; 

let app;
let db;
let auth;

if (firebaseConfig) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
}

// --- LOCAL STORAGE KEY ---
const SESSION_STORAGE_KEY = 'hostelfix_session_data';

// Global user state structure for the app
const initialUserState = {
    userId: null, // Firebase Auth UID
    userDocId: null, // Firestore Document ID (e.g., HostelID for students)
    role: null,
    loading: true,
    error: null,
    isAuthReady: false,
    mustChangePassword: false, // Tracks the requirement from DB/login
    isAuthenticated: false,
    forceMandatoryChange: false, // CRITICAL NEW FLAG: Locks view until submission
    userData: null, // Stores all user data from DB/Local storage
};

// Function to fetch user document from Firestore and determine role
// FIX: This function is now simulated as it was causing permission errors.
const fetchUserRole = async (uid) => {
    console.log("Simulating fetchUserRole for UID:", uid);
    // Return a default state, as we cannot query Firestore anonymously
    return { 
        role: 'student', 
        mustChangePassword: false, 
        userData: null, 
        userDocId: uid 
    };
};


// --- Custom Components for Enhanced UI ---

const PrimaryButton = ({ children, onClick, disabled = false, type = 'button', className = '' }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    type={type}
    className={`
      w-full py-3 px-4 font-semibold text-lg tracking-wider
      bg-indigo-600 text-white rounded-xl shadow-xl
      transition duration-300 ease-in-out transform
      hover:bg-indigo-700 hover:shadow-2xl active:scale-[0.98]
      disabled:bg-gray-400 disabled:shadow-none
      ${className}
    `}
  >
    {children}
  </button>
);

// FIX: Added 'optional' prop
const InputField = ({ icon: Icon, type, placeholder, value, onChange, className = '', readOnly = false, optional = false }) => (
  <div className="relative mb-5">
    <Icon className="absolute top-1/2 left-4 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      required={!readOnly && !optional} // FIX: Field is only required if not readOnly AND not optional
      readOnly={readOnly}
      className={`w-full py-3 pl-12 pr-4 border border-gray-300 rounded-xl focus:ring-4 focus:ring-indigo-500/50 focus:border-indigo-500 transition duration-150 shadow-md ${readOnly ? 'bg-gray-100 cursor-not-allowed text-gray-600' : 'bg-white'}`}
    />
  </div>
);

const RoleToggle = ({ role, setRole, disabled = false }) => (
  <div className={`flex bg-gray-100 rounded-xl p-1 mb-8 shadow-inner`}>
    {['student', 'warden'].map((r) => (
      <button
        key={r}
        onClick={() => setRole(r)}
        disabled={disabled}
        className={`
          flex-1 py-2 text-base font-semibold rounded-xl transition duration-300 ease-in-out
          ${role === r
            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/50 transform scale-[1.02]'
            : 'text-gray-600 hover:bg-white/70'
          }
        `}
      >
        <div className="flex items-center justify-center capitalize">
            {r === 'student' ? <User className="w-4 h-4 mr-2" /> : <Briefcase className="w-4 h-4 mr-2" />}
            {r}
        </div>
      </button>
    ))}
  </div>
);

const MessageBox = ({ title, text, type, onClose }) => {
    const baseClasses = "fixed top-5 right-5 z-50 p-4 rounded-lg shadow-2xl max-w-sm transition-all duration-300 transform";
    
    let colorClasses = "";
    let IconComponent = LogIn;

    switch (type) {
        case "success":
            colorClasses = "bg-green-100 border border-green-400 text-green-800 shadow-green-500/50";
            IconComponent = Home;
            break;
        case "error":
            colorClasses = "bg-red-100 border border-red-400 text-red-800 shadow-red-500/50";
            IconComponent = AlertTriangle;
            break;
        default:
            colorClasses = "bg-blue-100 border border-blue-400 text-blue-800 shadow-blue-500/50";
            IconComponent = Compass;
            break;
    }

    return (
        <div className={`${baseClasses} ${colorClasses} animate-slideIn`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center">
                    <IconComponent className="w-6 h-6 mr-3" />
                    <span className="font-bold text-lg">{title}</span>
                </div>
                <button 
                    onClick={onClose} 
                    className={`ml-4 p-1 rounded-full text-gray-500 hover:text-gray-900 transition`}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>
            <p className="mt-2 text-sm">{text}</p>
        </div>
    );
};

// --- Dashboard Card Component (Defined ONCE) ---
const DashboardCard = ({ icon: Icon, title, description, color, onClick = () => {} }) => (
    <button 
        onClick={onClick}
        className="w-full text-left bg-white p-6 rounded-2xl shadow-xl transition duration-300 ease-in-out transform hover:scale-[1.02] hover:shadow-2xl border-t-4 border-indigo-500 hover:border-t-indigo-600"
    >
        <Icon className={`w-8 h-8 mb-4 ${color}`} />
        <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600 text-sm">{description}</p>
    </button>
);


// --- Core Application Views ---

const LoginPage = ({ onLoginSuccess, onForgotPassword }) => {
  const [credential, setCredential] = useState(""); // Used for Email
  const [hostelId, setHostelId] = useState(""); // NEW: Added Hostel ID state
  const [password, setPassword] = useState("");
  const [roleType, setRoleType] = useState("student"); 
  const [isMessageVisible, setIsMessageVisible] = useState(false);
  const [message, setMessage] = useState({ title: "", text: "", type: "" });
  const [isLoading, setIsLoading] = useState(false); 

  // FIX: This useEffect hook clears inputs when the role changes.
  useEffect(() => {
    // Clear all input fields when the role is toggled
    setCredential("");
    setHostelId("");
    setPassword("");
    setIsMessageVisible(false); // Also hide any previous messages
  }, [roleType]); // Dependency: This runs *only* when roleType changes

  // Admin bypass is an exception
  const placeholder = credential === "bypass@admin.com" ? "Bypass Email" : (roleType === 'student' ? "Student Email" : "Warden Email");


  // --- LOGIN HANDLER (Reverted to Simulation) ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    // FIX: Updated validation
    if (!credential || !password || (roleType === 'student' && !hostelId)) {
      setMessage({ title: "Login Failed", text: `Please fill in all required fields.`, type: "error" });
      setIsMessageVisible(true);
      setIsLoading(false);
      return;
    }
    
    // --- ADMIN BYPASS (One-Time Use to Create Users) ---
    if (credential === "bypass@admin.com" && roleType === 'warden') {
        console.log("BYPASS: Forcing Warden Login");
        setMessage({
          title: "Admin Bypass",
          text: `Forcing Warden login to register users...`,
          type: "success",
        });
        
        setTimeout(() => {
            setIsMessageVisible(false);
            // Force login as 'warden'.
            onLoginSuccess({ role: 'warden', credential: 'admin-bypass', mustChange: false }); 
            setIsLoading(false);
        }, 1000);
        return; // Skip the database check
    }
    // --- END ADMIN BYPASS ---

    // --- SIMULATION LOGIN LOGIC ---
    // This logic replaces the database call to avoid permission errors.
    // It checks a "simulated" database (the password '123' or 'newpass123').
    
    // Check localStorage for a saved password for this user (simulating DB check)
    // FIX: We use the HostelID as the unique key for students, email for warden
    const userKey = roleType === 'student' ? hostelId : credential;
    const storedUserData = JSON.parse(localStorage.getItem(userKey) || "{}");
    
    let mustChange = false;
    let loginSuccess = false;

    // Check credentials match
    // For students, check if email and hostelId match what's stored
    const emailMatches = roleType === 'student' ? storedUserData.Email === credential : true;

    if (roleType === 'student' && !storedUserData.Password && password === '123' && emailMatches) {
        // Case 1: First-time student login with temporary password '123'
        loginSuccess = true;
        mustChange = true;
    } else if (roleType === 'warden' && !storedUserData.Password && password === '123') {
        // Case 1b: First-time warden login
        loginSuccess = true;
        mustChange = true;
    }
    else if (storedUserData.Password && password === storedUserData.Password && emailMatches) {
        // Case 2: Normal login with updated password
        loginSuccess = true;
        mustChange = false;
    }

    if (loginSuccess) {
        setMessage({
          title: "Login Successful",
          text: `Welcome! Authenticating as ${credential}...`,
          type: "success",
        });
        setIsMessageVisible(true);
        
        setTimeout(() => {
            setIsMessageVisible(false);
            // Pass the Document ID (userKey)
            onLoginSuccess({ role: roleType, credential: userKey, mustChange });
            setIsLoading(false);
        }, 1000); // Shorter delay for success
    } else {
        // Case 3: Wrong password
        setMessage({ title: "Login Failed", text: "Invalid Credentials.", type: "error" });
        setIsMessageVisible(true);
        setIsLoading(false);
    }
  };

  const closeMessage = () => setIsMessageVisible(false);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4 font-['Poppins']">
      
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
      <div className="w-full max-w-md bg-white p-8 md:p-10 rounded-3xl shadow-2xl transition duration-500 transform hover:shadow-xl hover:scale-[1.01]">
        
        {/* Header */}
        <div className="flex items-center justify-center mb-2">
            <Briefcase className="w-10 h-10 text-indigo-600 mr-3" />
            <h1 className="text-4xl font-extrabold text-gray-800 tracking-tight">HostelFix</h1>
        </div>
        <p className="text-center text-gray-500 mb-8 text-lg font-light">
            Sign in to manage facility issues.
        </p>
        
        {/* Role Selection Toggle */}
        <RoleToggle role={roleType} setRole={setRoleType} disabled={isLoading} />

        {/* Form */}
        <form onSubmit={handleLogin}>
          
          {/* FIX: Conditionally render Hostel ID field */}
          {roleType === 'student' && (
            <InputField
              icon={Shield} 
              type="text"
              placeholder="Hostel ID (e.g., A-101)"
              value={hostelId}
              onChange={(e) => setHostelId(e.target.value.toUpperCase())}
            />
          )}

          <InputField
            icon={Mail} 
            type="email" // Type is email, but bypass will be allowed
            placeholder={placeholder} // Use dynamic placeholder
            value={credential}
            // Allow non-email format only for the bypass
            onChange={(e) => setCredential(e.target.value)}
          />

          <InputField
            icon={LogIn}
            type="password"
            placeholder="Password" // Removed '123' hint, now dynamic
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <div className="mt-8">
            <PrimaryButton type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Sign In'}
            </PrimaryButton>
          </div>
        </form>
        
        {/* Footer Links (Mandatory links only) */}
        <div className="mt-6 text-center text-sm">
          <button 
            onClick={onForgotPassword}
            className="text-indigo-600 hover:text-indigo-800 transition duration-150 focus:outline-none"
            disabled={isLoading}
          >
            Forgot Password?
          </button>
        </div>

        {/* --- MODIFIED INQUIRY SECTION --- */}
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
        {/* --- END MODIFIED INQUIRY SECTION --- */}

      </div>
    </div>
  );
};

// --- New User Registration View (Module 1.1) ---

const RegisterUserPage = ({ onBackToLogin }) => {
    const [name, setName] = useState("");
    const [hostelId, setHostelId] = useState("");
    const [email, setEmail] = useState("");
    const [contactNo, setContactNo] = useState("");
    const [role, setRole] = useState("student");
    const [tempPassword, setTempPassword] = useState("123"); // Default temporary password
    const [isMessageVisible, setIsMessageVisible] = useState(false);
    const [message, setMessage] = useState({ title: "", text: "", type: "" });
    const [isLoading, setIsLoading] = useState(false);

    // Placeholder for Warden/Admin to create a system account
    const handleRegisterUser = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        // FIX: Validation now only requires Name, Hostel ID, and Email
        if (!name || !hostelId || !email) {
            setMessage({ title: "Error", text: "Please fill in Name, Hostel ID, and Email.", type: "error" });
            setIsMessageVisible(true);
            setIsLoading(false);
            return;
        }

        // --- SIMULATION: Save to localStorage ---
        
        try {
            // FIX: Create separate keys for Hostel ID and Email to check uniqueness
            const hostelIdKey = hostelId;
            const emailKey = `EMAIL_${email}`; // Create a unique key for the email index

            // Check 1: Is Hostel ID already used?
            if (localStorage.getItem(hostelIdKey)) {
                throw new Error(`Hostel ID ${hostelId} is already registered.`);
            }
            // Check 2: Is Email already used?
            if (localStorage.getItem(emailKey)) {
                // We need to check if the EMAIL key points to a different Hostel ID document
                const existingHostelId = localStorage.getItem(emailKey);
                if (existingHostelId !== hostelIdKey) {
                    throw new Error(`Email ${email} is already in use by another account.`);
                }
            }

            // All checks passed, create the user
            const newUserData = {
                UserID: hostelId, // Use Hostel ID as the Doc ID key
                Email: email,
                Name: name,
                Role: role,
                HostelID: hostelId, // Separate field for room/hostel identifier
                ContactNo: contactNo || 'N/A',
                DateCreated: new Date().toISOString(),
                MustChangePassword: true, // MANDATORY requirement!
                Password: null, // Initially, there is no set password
            };

            // Save the main data (keyed by Hostel ID)
            localStorage.setItem(hostelIdKey, JSON.stringify(newUserData));
            // Save the email index (keyed by email)
            localStorage.setItem(emailKey, hostelIdKey); // Store the HostelID as the value for reference

            setMessage({
                title: "Account Created!",
                text: `${name} (${hostelId}) registered successfully. Temporary Password: ${tempPassword}.`,
                type: "success"
            });
            // Clear form
            setName(""); setHostelId(""); setEmail(""); setContactNo("");
            
        } catch (error) {
                console.error("Error registering user (simulation):", error);
                setMessage({
                    title: "Registration Failed",
                    text: error.message, // Display the custom error message
                    type: "error"
                });
            setIsLoading(false);
            setIsMessageVisible(true);
            return;
        }
        setIsLoading(false);
        setIsMessageVisible(true);
    };

    const closeMessage = () => setIsMessageVisible(false);


    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-5">
            {isMessageVisible && (
                <MessageBox title={message.title} text={message.text} type={message.type} onClose={closeMessage} />
            )}

            <div className="w-full max-w-lg bg-white p-8 md:p-10 rounded-3xl shadow-2xl">
                
                <div className="flex items-center justify-center mb-2">
                    <Plus className="w-8 h-8 text-indigo-600 mr-3" />
                    <h1 className="text-3xl font-extrabold text-gray-800 tracking-tight">Register User</h1>
                </div>
                <p className="text-center text-gray-500 mb-6 text-lg font-light">
                    (Admin/Warden function to pre-populate student accounts)
                </p>

                <form onSubmit={handleRegisterUser}>
                    <RoleToggle role={role} setRole={setRole} disabled={isLoading} />
                    
                    <InputField icon={User} type="text" placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} />
                    <InputField icon={Shield} type="text" placeholder="Hostel ID (e.g., A-101)" value={hostelId} onChange={(e) => setHostelId(e.target.value.toUpperCase())} />
                    <InputField icon={Mail} type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} />
                    {/* FIX: Added optional={true} prop */}
                    <InputField icon={Compass} type="tel" placeholder="Contact No (Optional)" value={contactNo} onChange={(e) => setContactNo(e.target.value)} optional={true} />
                    
                    <div className="bg-yellow-50 border border-yellow-300 p-3 rounded-lg text-sm text-yellow-800 mb-6">
                        <p className="font-semibold">Temporary Password: {tempPassword}</p>
                        <p>User will be forced to change this upon first login.</p>
                    </div>

                    <PrimaryButton type="submit" disabled={isLoading}>
                      {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : `Create ${role} Account`}
                    </PrimaryButton>
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

// --- New Change Password View (Module 2.2) ---

// Updated to receive userDocId prop
const ChangePasswordPage = ({ onForcedPasswordChangeComplete, userId, userDocId, userRole, isVoluntary = false, onCancel }) => { 
    const [oldPassword, setOldPassword] = useState(""); // State for current password
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isMessageVisible, setIsMessageVisible] = useState(false);
    const [message, setMessage] = useState({ title: "", text: "", type: "" });
    const [isLoading, setIsLoading] = useState(false);

    const handleChangePassword = async (e) => {
        e.preventDefault(); // CRITICAL FIX: Stop form default behavior
        setIsLoading(true);

        // --- VALIDATION RULES (Action-based failure) ---
        // FIX: Updated regex to include symbols
        const alphanumericSymbol = /^(?=.*[a-zA-Z])(?=.*[0-9])(?=.*[^a-zA-Z0-9\s]).{8,}$/; 

        if (!newPassword || !confirmPassword) {
            setMessage({ title: "Error", text: "Password fields cannot be empty.", type: "error" });
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
        // MODIFIED: Check length and alphanumeric requirement
        if (!alphanumericSymbol.test(newPassword)) { // Check against new stricter rule
            setMessage({ title: "Error", text: "Password must be at least 8 characters long and contain letters, numbers, and symbols.", type: "error" });
            setIsMessageVisible(true);
            setIsLoading(false); 
            return;
        }

        // --- OLD PASSWORD VERIFICATION FOR VOLUNTARY CHANGES ---
        if (isVoluntary) {
            // Get stored user data
            const storedData = localStorage.getItem(userDocId);
            if (!storedData) {
                setMessage({ title: "Error", text: "User data not found.", type: "error" });
                setIsMessageVisible(true);
                setIsLoading(false);
                return;
            }

            const storedUserData = JSON.parse(storedData);
            const currentStoredPassword = storedUserData.Password;
            
            // For voluntary changes, verify old password matches
            if (currentStoredPassword !== oldPassword) {
                setMessage({ title: "Error", text: "Current password is incorrect.", type: "error" });
                setIsMessageVisible(true);
                setIsLoading(false);
                return;
            }

            // Additional check: New password shouldn't be same as old password
            if (oldPassword === newPassword) {
                setMessage({ title: "Error", text: "New password must be different from current password.", type: "error" });
                setIsMessageVisible(true);
                setIsLoading(false);
                return;
            }
        }

        // --- PASSWORD CHANGE IMPLEMENTATION (SIMULATED) ---
        try {
             // 1. Simulate saving password to localStorage
             const docId = userDocId;
             if (!docId) { // Add a check for userDocId
                 throw new Error("User Document ID is missing, cannot update password flag.");
             }
             
             // Get the existing data
             const storedData = localStorage.getItem(docId);
             if (!storedData) {
                 throw new Error("User session data not found for update.");
             }
             const storedUserData = JSON.parse(storedData);
             
             // Update the data
             storedUserData.MustChangePassword = false;
             storedUserData.Password = newPassword; // Save the new password

             // Save it back to localStorage
             localStorage.setItem(docId, JSON.stringify(storedUserData));

             // Show success message
             setMessage({
                title: "Success!",
                text: "Your password has been securely updated.", // Removed redirecting text
                type: "success"
             });
             setIsMessageVisible(true);
             
             // Handle completion
             if (isVoluntary) {
                // For voluntary change, show success message then navigate back to Profile Page
                setTimeout(() => {
                    if (onCancel) onCancel(); 
                }, 1500); 
             } else {
                // Mandatory change navigates immediately to Dashboard via App state update
                onForcedPasswordChangeComplete();
             }

        } catch (error) {
            console.error("Password update error:", error);
            setMessage({ title: "Update Failed", text: `Could not save new password: ${error.message}`, type: "error" });
            setIsMessageVisible(true);
            setIsLoading(false);
        }
    };

    const closeMessage = () => setIsMessageVisible(false);

    // Determine if form is valid
    const isFormValid = () => {
        const alphanumericSymbol = /^(?=.*[a-zA-Z])(?=.*[0-9])(?=.*[^a-zA-Z0-9\s]).{8,}$/;
        const newPassValid = newPassword && alphanumericSymbol.test(newPassword);
        const matchValid = newPassword === confirmPassword;
        
        if (isVoluntary) {
            // For voluntary changes: all fields required and new password different from old
            return oldPassword && 
                   newPassValid && 
                   matchValid &&
                   oldPassword !== newPassword;
        } else {
            // For forced changes: only new password fields required
            return newPassValid && matchValid;
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-indigo-50 p-4">
            {isMessageVisible && (
                <MessageBox title={message.title} text={message.text} type={message.type} onClose={closeMessage} />
            )}

            <div className="w-full max-w-xl bg-white p-8 md:p-10 rounded-3xl shadow-2xl"> {/* Increased width */}
                
                <div className="flex items-center justify-center mb-2">
                    <Lock className="w-8 h-8 text-red-600 mr-3" />
                    <h1 className="text-3xl font-extrabold text-gray-800 tracking-tight">
                        {isVoluntary ? "Change Password" : "Mandatory Change"}
                    </h1>
                </div>
                
                <p className="text-center text-red-600 mb-6 text-lg font-bold border-b pb-4">
                    {isVoluntary ? "Update your password securely." : "Your temporary password must be changed immediately."}
                </p>
                
                <p className="text-center text-gray-600 mb-8 text-sm">
                    Logged in as <strong>{userRole}</strong> ({userDocId || userId})
                </p>

                <form onSubmit={handleChangePassword}>
                    {/* NEW: Old Password Field (Only for voluntary changes) */}
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
                    
                    {/* Validation Hints */}
                    
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

                    <PrimaryButton 
                        type="submit" 
                        disabled={isLoading || !isFormValid()}
                    >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Set New Password'}
                    </PrimaryButton>
                </form>

                {/* Cancel Button for Voluntary Changes */}
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

// --- NEW: Password Recovery Page (Module 3.0) ---
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

        // --- SIMULATION LOGIC ---
        // In a real app, this would call Firebase Auth's sendPasswordResetEmail(auth, email)
        console.log(`Simulating password reset for ${email}`);
        
        // Simulate success
        setMessage({
            title: "Check Your Email",
            text: "If an account exists for this email, a password reset link has been sent.",
            type: "success"
        });
        setIsMessageVisible(true);
        setIsLoading(false);
        setEmail(""); // Clear field
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


// Profile Management Page (Module 5.0)
const ProfileManagementPage = ({ appState, onBackToDashboard, onPasswordChange }) => {
    // FIX: Load initial data from appState.userData or default values
    const initialData = appState.userData || {
        Name: "Loading Name...",
        Email: appState.userDocId || "user@example.com",
        ContactNo: "",
        HostelID: appState.userDocId,
        Role: appState.role,
    };
    
    const [profileData, setProfileData] = useState(initialData);
    const [isEditing, setIsEditing] = useState(false);
    const [isMessageVisible, setIsMessageVisible] = useState(false);
    const [message, setMessage] = useState({ title: "", text: "", type: "" });
    const [isLoading, setIsLoading] = useState(false);
    
    // Determine the primary ID to display
    const primaryIdLabel = appState.role === 'student' ? 'Hostel ID' : 'User ID';
    const primaryIdValue = profileData.HostelID || appState.userDocId;

    const handleFieldChange = (e) => {
        const { name, value } = e.target;
        setProfileData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = () => {
        setIsLoading(true);

        // --- SIMULATION: Save to LocalStorage ---
        try {
            // Validation: Name and Email should not be empty.
            if (!profileData.Name || !profileData.Email) {
                throw new Error("Name and Email cannot be empty.");
            }
            
            // Re-validate Email uniqueness (Optional for this sim)
            
            // Save updated fields back to localStorage using the unique doc ID
            localStorage.setItem(primaryIdValue, JSON.stringify(profileData));
            
            setMessage({
                title: "Profile Saved",
                text: "Your contact details have been updated.",
                type: "success"
            });
            setIsEditing(false); // Exit edit mode
            
        } catch (error) {
            console.error("Save profile error:", error);
            setMessage({
                title: "Save Failed",
                text: error.message || "Failed to update profile data.",
                type: "error"
            });
        }
        setIsLoading(false);
        setIsMessageVisible(true);
        
    };
    
    const closeMessage = () => setIsMessageVisible(false);


    return (
        <div className="p-8 bg-gray-100 min-h-screen font-['Poppins']">
            {isMessageVisible && (
                <MessageBox title={message.title} text={message.text} type={message.type} onClose={closeMessage} />
            )}
            <div className="max-w-3xl mx-auto w-full"> {/* FIX: Changed max-w-xl to max-w-3xl for wider frame */}
                <div className="flex items-center justify-between mb-6 border-b pb-4">
                    <button onClick={onBackToDashboard} className="text-indigo-600 hover:text-indigo-800 transition flex items-center">
                        <ArrowLeft className="w-5 h-5 mr-2" /> Back to Dashboard
                    </button>
                    <h1 className="text-3xl font-extrabold text-gray-800">User Profile</h1>
                </div>

                <div className="bg-white p-8 rounded-3xl shadow-2xl">
                    <div className="flex justify-between items-start mb-6 px-4">
                        <h2 className="text-2xl font-bold text-indigo-700">Personal Details</h2>
                        
                        {isEditing ? (
                            <PrimaryButton 
                                onClick={handleSave} 
                                className="w-350 px-12 py-6 text-sm bg-indigo-500 hover:bg-indigo-600 pr-25"
                                disabled={isLoading}
                            >
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                            </PrimaryButton>
                        ) : (
                            <PrimaryButton 
                                onClick={() => setIsEditing(true)} 
                                className="w-350 px-12 py-6 text-sm bg-indigo-500 hover:bg-indigo-600 pr-25"
                            >
                                Edit Profile
                            </PrimaryButton>
                        )}
                    </div>
                    <form>
                        {/* Name */}
                        <InputField
                            icon={User}
                            type="text"
                            placeholder="Full Name"
                            name="Name"
                            value={profileData.Name}
                            onChange={handleFieldChange}
                            readOnly={!isEditing}
                        />

                        {/* Role (Read Only) */}
                        <InputField
                            icon={Briefcase}
                            type="text"
                            placeholder="Role"
                            value={profileData.Role ? profileData.Role.charAt(0).toUpperCase() + profileData.Role.slice(1) : appState.role.charAt(0).toUpperCase() + appState.role.slice(1)}
                            readOnly={true}
                        />
                        
                        {/* Hostel ID / Primary ID (Read Only) */}
                        <InputField
                            icon={Shield}
                            type="text"
                            placeholder={primaryIdLabel}
                            value={primaryIdValue}
                            readOnly={true}
                        />

                        {/* Email (Read Only) */}
                        <InputField
                            icon={Mail}
                            type="email"
                            placeholder="Email Address"
                            value={profileData.Email}
                            readOnly={true}
                        />
                        
                        {/* Contact No (Editable if editing is true) */}
                        <InputField
                            icon={Phone}
                            type="tel"
                            placeholder="Contact Number (Optional)"
                            name="ContactNo"
                            value={profileData.ContactNo}
                            onChange={handleFieldChange}
                            readOnly={!isEditing}
                            optional={true}
                        />
                    </form>

                    {/* Change Password Section */}
                    <div className="mt-8 border-t pt-6">
                        <h2 className="text-xl font-bold text-gray-800 mb-4">Security</h2>
                        <PrimaryButton 
                            onClick={onPasswordChange}
                            className="w-full bg-red-500 hover:bg-red-600"
                        >
                            <div className="flex items-center justify-center">
                                <Lock className="w-5 h-5 mr-2" /> Change Password
                            </div>
                        </PrimaryButton>
                    </div>
                </div>
            </div>
        </div>
    );
};


// Placeholder Student Dashboard
const StudentDashboard = ({ onLogout, userId, userDocId, userRole, onViewChange }) => ( // Added userDocId
  <div className="p-8 bg-indigo-50 min-h-screen font-['Poppins']">
    <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-extrabold text-indigo-700 mb-6 border-b pb-2">Student Portal - HostelFix</h1>
        <div className="bg-white p-6 rounded-2xl shadow-xl mb-8 flex justify-between items-center">
            <div>
                <p className="text-lg text-gray-700">Welcome, Student! Get started by submitting a new complaint.</p>
                <p className="text-xs text-gray-500 mt-1">User ID (Hostel ID): {userDocId || userId} | Role: {userRole}</p>
            </div>
            <div className="flex items-center">
                <button 
                    onClick={() => onViewChange('profile-management')} 
                    className="mr-4 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition"
                    title="Profile Settings"
                >
                    <Settings className="w-5 h-5 text-gray-600" />
                </button>
                <PrimaryButton onClick={onLogout} className="w-auto px-6 bg-red-500 hover:bg-red-600 ml-4">
                    <div className="flex items-center justify-center"><LogOut className="w-5 h-5 mr-2" /> Log Out</div>
                </PrimaryButton>
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <DashboardCard 
                icon={AlertTriangle} 
                title="Register Complaint" 
                description="Log a new issue with room or facilities (Module 2)." 
                color="text-red-500" 
            />
            <DashboardCard 
                icon={MessageSquare} 
                title="Complaint Tracking" 
                description="View status (Pending, Resolved) and history." 
                color="text-blue-500" 
            />
            <DashboardCard 
                icon={Shield} 
                title="View Announcements" 
                description="Warden updates and maintenance schedules." 
                color="text-green-500" 
            />
        </div>
    </div>
  </div>
);

// Placeholder Warden Dashboard
const WardenDashboard = ({ onLogout, userId, userDocId, userRole, onViewChange }) => ( // Added userDocId
  <div className="p-8 bg-gray-100 min-h-screen font-['Poppins']">
    <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-extrabold text-gray-800 mb-6 border-b pb-2">Warden Portal - HostelFix Management</h1>
        <div className="bg-white p-6 rounded-2xl shadow-xl mb-8 flex justify-between items-center">
            <div>
                <p className="text-lg text-gray-700">Welcome, Warden/Staff! Use the tools below to manage and resolve facility issues.</p>
                <p className="text-xs text-gray-500 mt-1">User ID: {userDocId || userId} | Role: {userRole}</p>
            </div>
            <div className="flex items-center">
                <button 
                    onClick={() => onViewChange('register-user')} 
                    className="mr-4 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition text-green-600 font-semibold"
                    title="Register New User"
                >
                    <Users className="w-5 h-5 text-green-600" />
                </button>
                <button 
                    onClick={() => onViewChange('profile-management')} 
                    className="mr-4 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition"
                    title="Profile Settings"
                >
                    <Settings className="w-5 h-5 text-gray-600" />
                </button>
                <PrimaryButton onClick={onLogout} className="w-auto px-6 bg-red-500 hover:bg-red-600 ml-4">
                    <div className="flex items-center justify-center"><LogOut className="w-5 h-5 mr-2" /> Log Out</div>
                </PrimaryButton>
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <DashboardCard 
                icon={AlertTriangle} 
                title="New Complaints (5)" 
                description="Review and assign unhandled issues (Module 2)." 
                color="text-red-500" 
            />
            <DashboardCard 
                icon={MessageSquare} 
                title="Feedback Review" 
                description="Analyze student satisfaction ratings (Module 3)." 
                color="text-indigo-500" 
            />
            <DashboardCard 
                icon={BarChart3} 
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
  const [appState, setAppState] = useState(initialUserState);
  const [view, setView] = useState("login"); // 'login', 'student', 'warden', 'password-recovery', 'change-password', 'register-user', 'profile-management'

  // --- FIREBASE AUTH LISTENER & INITIALIZATION ---
  useEffect(() => {
    // FIX: Check for session in localStorage on initial load
    try {
        const savedSession = localStorage.getItem(SESSION_STORAGE_KEY);
        if (savedSession) {
            const sessionData = JSON.parse(savedSession);
            // We have a session. Set the state and skip anonymous auth.
            
            // FIX: Load full user data from userDocId key
            const storedUserData = JSON.parse(localStorage.getItem(sessionData.userDocId) || "{}");
            
            setAppState(prev => ({
                ...initialUserState,
                userId: sessionData.userId, 
                userDocId: sessionData.userDocId, 
                role: sessionData.role,
                isAuthenticated: true,
                loading: false,
                isAuthReady: true,
                userData: storedUserData // Set the full user data for profile page
            }));
            setView(sessionData.role); // Go directly to dashboard
            return; // Stop the useEffect from running auth listeners
        }
    } catch (e) {
        console.error("Failed to parse saved session", e);
        localStorage.removeItem(SESSION_STORAGE_KEY);
    }
      
    if (!firebaseConfig) {
        // Running without Firebase (simulation/localStorage mode).
        // Mark auth as ready so the app shows the Login screen instead of the persistent loader.
        setAppState(prev => ({ ...prev, loading: false, isAuthReady: true }));
        // If you want a visible warning, use the line below instead:
        // setAppState(prev => ({ ...prev, loading: false, isAuthReady: true, error: "Firebase config missing. Running in simulation mode." }));
        return;
    }

    const initAuth = async () => {
        for (let i = 0; i < 3; i++) {
            try {
                if (initialAuthToken) {
                    await signInWithCustomToken(auth, initialAuthToken);
                } else {
                    await signInAnonymously(auth);
                }
                break; 
            } catch (error) {
                // FIX: If custom token is invalid, fall back to anonymous sign-in
                if (error.code === 'auth/invalid-custom-token') {
                    console.error("Invalid custom token detected. Falling back to anonymous sign-in.");
                    try {
                        await signInAnonymously(auth);
                        break; // Anonymous sign-in successful, exit loop
                    } catch (anonError) {
                        console.error("Anonymous sign-in fallback failed:", anonError);
                        // Continue to retry/throw logic
                    }
                }
                
                if (i < 2) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
                } else {
                    throw error;
                }
            }
        }
    };

    initAuth().catch(error => {
        console.error("Firebase Auth initialization failed after retries:", error);
        setAppState(prev => ({ ...prev, loading: false, error: "Authentication failed after retries." }));
    });

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
        // If we are already authenticated from localStorage, don't let onAuthStateChanged override it
        if (appState.isAuthenticated) {
             // Keep loading false, auth is ready
             setAppState(prev => ({ ...prev, loading: false, isAuthReady: true }));
             return;
        }

        if (user) {
            // This logic now only runs for anonymous users on first load (no session)
            const idToFetch = user.uid;
            
            // We set loading to false here because fetchUserRole is simulated and fast
             setAppState(prev => ({ ...prev, loading: false, isAuthReady: true, userId: user.uid }));
            
            if (view !== 'password-recovery' && view !== 'register-user') {
                setView('login');
            }
            return; 

        } else {
            // User signed out, reset state
            // FIX: Set a clean logged-out state instead of the initial loading state
            setAppState({
                ...initialUserState, // Get all the nulls/falses
                loading: false,      // Explicitly set loading to false
                isAuthReady: true,     // Auth state is ready (we are logged out)
                isAuthenticated: false, // Ensure authenticated is false
                forceMandatoryChange: false // Ensure forceMandatoryChange is false
            }); 
            setView('login');
        }
    });

    return () => unsubscribe();
  // FIX: Run only once on mount
  }, []); 

  // --- VIEW HANDLERS ---
  const handleLoginSuccess = ({ role, credential, mustChange }) => {
    // This is the simulation hook for manual sign-in
    
    const userKey = credential; // The HostelID/Email used as the primary lookup key
    const storedUserData = JSON.parse(localStorage.getItem(userKey) || "{}");

    // --- FIX: Save to localStorage ---
    const sessionData = {
        role: role,
        userId: credential, // This is the Auth UID (simulated as HostelID)
        userDocId: credential, // This is the Doc ID (HostelID)
    };
    try {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
    } catch (e) {
        console.error("Failed to save session to localStorage", e);
    }
    // --- END FIX ---
    
    setAppState(prev => ({ 
        ...prev, 
        role: role, 
        userId: credential, 
        userDocId: credential, 
        isAuthenticated: true, // Mark as authenticated
        isAuthReady: true,
        mustChangePassword: mustChange, // Set based on the simulation
        forceMandatoryChange: mustChange, // LOCK the view if needed
        userData: storedUserData // Store full user data on successful login
    }));
    
    // Set View based on state AFTER state update
    if (mustChange) {
        setView('change-password');
    } else {
        setView(role);
    }
  };

  // NEW Handler for completing the forced password change
  const handleForcedPasswordChangeComplete = () => {
    // Reload user data to capture the new Password=false flag and new password
    const userKey = appState.userDocId;
    const storedUserData = JSON.parse(localStorage.getItem(userKey) || "{}");
    
    // Unlock the view and navigate
    setAppState(prev => ({ 
        ...prev, 
        mustChangePassword: false, 
        forceMandatoryChange: false,
        userData: storedUserData // Update the user data with the new password
    }));
    setView(appState.role); // Navigate based on the stored role
  };

  const handleLogout = async () => {
    // FIX: Clear local storage on logout
    try {
        localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (e) {
        console.error("Failed to clear session from localStorage", e);
    }
            
    if (auth) {
        try {
            await signOut(auth);
            // onAuthStateChanged will handle state reset and navigation to 'login'
        } catch (error) {
            console.error("Logout failed:", error);
        }
    } else {
         // Manual simulation logout fallback
        setAppState(initialUserState);
        setView("login");
    }
    
    // FIX: Force reset state and view immediately
    setAppState({
        ...initialUserState,
        loading: false,
        isAuthReady: true,
    });
    setView("login");
  };
  
  const handleForgotPasswordClick = () => {
    setView("password-recovery");
  };

  const handleBackToLogin = () => {
    setView("login");
  };
  
  const handleViewChange = (newView) => {
    // FIX: Ensure if we are going to profile management, we set the view correctly
    if (newView === 'profile-management') {
        // Reload the latest data before navigating to profile page
        const userKey = appState.userDocId;
        const storedUserData = JSON.parse(localStorage.getItem(userKey) || "{}");
        setAppState(prev => ({ ...prev, userData: storedUserData }));
    }
    setView(newView);
  };

  // --- RENDERING ---
  const renderView = () => {
    if (appState.loading || !appState.isAuthReady) { // Added !isAuthReady check
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mr-3" />
                <p className="text-xl text-indigo-700 font-semibold">Connecting to HostelFix...</p>
            </div>
        );
    }

    if (appState.error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 p-4">
                <AlertTriangle className="w-12 h-12 text-red-600 mb-4" />
                <h2 className="text-2xl font-bold text-red-800 mb-2">System Error</h2>
                <p className="text-red-700">{appState.error}</p>
                <p className="text-sm text-red-500 mt-4">User ID: {appState.userId || 'N/A'}</p>
                 {/* Debugging: Show Doc ID */}
                <p className="text-xs text-red-400 mt-1">Doc ID: {appState.userDocId || 'N/A'}</p>
            </div>
        );
    }
    
    // FINAL FIX: Prioritize the forceMandatoryChange flag above all else
    if (appState.forceMandatoryChange) {
        return <ChangePasswordPage 
                    onForcedPasswordChangeComplete={handleForcedPasswordChangeComplete}
                    userId={appState.userId}
                    userDocId={appState.userDocId}
                    userRole={appState.role}
                    isVoluntary={false} // Mandatory context
                    onCancel={null} // No cancel button on mandatory page
                />;
    }

    switch (view) {
      case "student":
        // Only render dashboard if explicitly authenticated
        return appState.isAuthenticated ? (
          <StudentDashboard onLogout={handleLogout} userId={appState.userId} userDocId={appState.userDocId} userRole={appState.role} onViewChange={handleViewChange} />
        ) : <LoginPage onLoginSuccess={handleLoginSuccess} onForgotPassword={handleForgotPasswordClick} />;
        
      case "warden":
        // Only render dashboard if explicitly authenticated
        return appState.isAuthenticated ? (
          <WardenDashboard onLogout={handleLogout} userId={appState.userId} userDocId={appState.userDocId} userRole={appState.role} onViewChange={handleViewChange} />
        ) : <LoginPage onLoginSuccess={handleLoginSuccess} onForgotPassword={handleForgotPasswordClick} />;
      
      case "profile-management":
        return <ProfileManagementPage 
                    appState={appState} 
                    onBackToDashboard={() => handleViewChange(appState.role)} 
                    onPasswordChange={() => handleViewChange('change-password-voluntary')} // FIX: Use handleViewChange
                />;

      case "change-password-voluntary": // Voluntary Change (Reached from Profile Page)
        return <ChangePasswordPage 
                    onForcedPasswordChangeComplete={handleForcedPasswordChangeComplete}
                    userId={appState.userId}
                    userDocId={appState.userDocId}
                    userRole={appState.role}
                    isVoluntary={true}
                    onCancel={() => setView('profile-management')} // Go back to profile
                />;

      case "password-recovery":
        return <PasswordRecoveryPage onBackToLogin={handleBackToLogin} />; 
      case "register-user":
        return <RegisterUserPage onBackToLogin={handleBackToLogin} />;
      case "login":
      default:
        // If somehow authenticated but on login, and not forced change, redirect
        if (appState.isAuthenticated && appState.role && !appState.forceMandatoryChange) {
            setView(appState.role); // Trigger re-render to dashboard
            return null; // Render nothing momentarily while redirecting
        }
        return <LoginPage onLoginSuccess={handleLoginSuccess} onForgotPassword={handleForgotPasswordClick} />;
    }
  };

  return (
    <div className="min-h-screen font-sans bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {renderView()}
    </div>
  );
};

export default App;
import React, { useState, useEffect } from "react";
import { LogIn, Briefcase, Mail, Shield, User, Phone, Loader2 } from "lucide-react";

// --- Import UI Components ---
import PrimaryButton from '../components/PrimaryButton';
import InputField from '../components/InputField';
import MessageBox from '../components/MessageBox';
import RoleToggle from '../components/RoleToggle';

//Import necessary API helpers
import { 
    auth, 
    signInWithEmailAndPassword,
    signOut,
    fetchUserRole
} from '../api/firebase';
import { wardenSessionCache } from '../api/cache';

const LoginPage = ({ onForgotPassword, onLoginFailure }) => { 
    const [credential, setCredential] = useState("");
    const [hostelId, setHostelId] = useState("");
    const [password, setPassword] = useState("");
    const [roleType, setRoleType] = useState("student");
    const [isMessageVisible, setIsMessageVisible] = useState(false);
    const [message, setMessage] = useState({ title: "", text: "", type: "" });
    const [isLoading, setIsLoading] = useState(false);
    const displayDuration = 3000; // 3 seconds

    useEffect(() => {
        setCredential("");
        setHostelId("");
        setPassword("");
        setIsMessageVisible(false);
    }, [roleType]);

    const showMessage = (title, text, type) => {
        setMessage({ title, text, type });
        setIsMessageVisible(true);
    };

    const closeMessage = () => setIsMessageVisible(false);

    const placeholder = roleType === 'student' ? "Student Email" : "Warden Email";

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setIsMessageVisible(false); // Hide old messages

        // --- 1. Client-Side Required Field Check ---
        if (!credential || !password || (roleType === 'student' && !hostelId)) {
            setIsLoading(false);
            showMessage("Login Failed", "Please fill in all required fields.", "error");
            return;
        }

        // --- 2. Email Format Validation ---
        const studentRegex = /^\S+@student\.usm\.my$/i;
        const normalizedEmail = credential.toLowerCase();
        let validationError = null;

        if (roleType === 'student') {
            if (!studentRegex.test(normalizedEmail)) {
                validationError = "Invalid Student Email. Must be in the format 'xxx@student.usm.my'.";
            }
        } else if (roleType === 'warden') {
            if (studentRegex.test(normalizedEmail)) {
                validationError = "Invalid Warden Email. Please use a '@usm.my' address, not a student email.";
            } else if (!normalizedEmail.endsWith('@usm.my')) {
                validationError = "Invalid Warden Email. Must be in the format 'xxx@usm.my'.";
            }
        }

        if (validationError) {
            setIsLoading(false);
            showMessage("Validation Error", validationError, "error");
            return;
        }

        // 3. Cache warden credentials
        if (roleType === 'warden') {
            wardenSessionCache.email = normalizedEmail;
            wardenSessionCache.password = password;
        }

        // --- 4. CORE LOGIN AND SECURITY CHECK ---
        try {
            // 4a. AUTHENTICATION: Check Email and Password (Firebase Auth)
            const userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
            const user = userCredential.user;

            // --- ✅ HOSTEL ID SECURITY CHECK (Only for Students) ---
            if (roleType === 'student') {
                // 4b. Fetch user data from Firestore
                const firestoreData = await fetchUserRole(user.uid, user.email);

                if (!firestoreData.userData || !firestoreData.userData.hostelId) {
                    await signOut(auth); // Sign out the user
                    setIsLoading(false);
                    showMessage("Login Failed", "Your account data is incomplete. Please contact admin.", "error");
                    return;
                }
                
                // 4c. VALIDATE HOSTEL ID
                const typedHostelId = hostelId.trim().toUpperCase();
                const dbHostelId = firestoreData.userData.hostelId.trim().toUpperCase();

                console.log("Typed Hostel ID:", typedHostelId);
                console.log("DB Hostel ID:", dbHostelId);
                console.log("Match:", typedHostelId === dbHostelId);

                if (typedHostelId !== dbHostelId) {
                    // 4d. If Hostel ID is WRONG, SIGN OUT and fail the login
                    await signOut(auth); 

                    if (onLoginFailure) {
                        onLoginFailure(true); // Signal App.jsx to temporarily lock auth
                    } else {
                        console.error("onLoginFailure prop is missing in LoginPage");
                    }
                    
                    showMessage("Login Failed", "The Hostel ID you entered does not match the email on record.", "error");
                    
                    // Delay unlocking the form until the message has been displayed
                    setTimeout(() => {
                        setIsMessageVisible(false);
                        setIsLoading(false); 
                    }, displayDuration);

                    return;
                }
            }
            // --- ✅ SECURITY CHECK PASSED ---

            // 5. If successful and passed all checks, the user is signed in.
            // onAuthStateChanged in App.jsx takes over routing.
            showMessage("Login Successful", "Verification complete. Routing to dashboard...", "success");
            setTimeout(() => {
                setIsMessageVisible(false);
                setIsLoading(false);
            }, 2000);

        } catch (error) {
            // --- 6. Error Handling ---
            console.error("Login error:", error);
            let errorMessage = "Login failed. Please check your credentials.";

            if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
                errorMessage = "Invalid email or password.";
            } else if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-email') {
                errorMessage = "No account found with this email.";
            } else if (error.message.includes("corrupted")) {
                errorMessage = error.message;
            }

            setIsLoading(false);
            showMessage("Login Failed", errorMessage, "error");
            // Standard error messages do not auto-dismiss unless you add a setTimeout here as well.
            // Keeping it consistent with the success message:
            setTimeout(() => setIsMessageVisible(false), 3000); 
        }
    };

    return (
        <div 
            className="relative flex flex-col items-center justify-center min-h-screen bg-gray-50 bg-cover bg-center p-4"
            style={{ backgroundImage: "url('/login-bg.jpg')" }} 
        >

            {/* 2. OVERLAY (for readability) */}
            <div className="absolute inset-0 bg-black opacity-50 z-0"></div>

            {/* --- Message Container fixed to Top Right --- */}
            <div className="fixed top-4 right-4 z-50 max-w-sm w-full p-2">
                {isMessageVisible && (
                    <MessageBox
                        title={message.title}
                        text={message.text}
                        type={message.type}
                        onClose={closeMessage}
                        className="pointer-events-auto" 
                    />
                )}
            </div>
            {/* --- END Message Container --- */}

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
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Sign In'}
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

// // src/pages/LoginPage.jsx

// import React, { useState, useEffect } from "react";
// import { LogIn, Briefcase, Mail, Shield, User, Phone, Loader2 } from "lucide-react";

// // --- Import UI Components ---
// import PrimaryButton from '../components/PrimaryButton';
// import InputField from '../components/InputField';
// import MessageBox from '../components/MessageBox';
// import RoleToggle from '../components/RoleToggle';

// //Import necessary API helpers
//  import { 
//      auth, 
//      signInWithEmailAndPassword,
//      signOut,
//      fetchUserRole
//      //wardenSessionCache 
//  } from '../api/firebase';
// import { wardenSessionCache } from '../api/cache';

// const LoginPage = ({ onLoginSuccess, onForgotPassword }) => {
//     const [credential, setCredential] = useState("");
//     const [hostelId, setHostelId] = useState("");
//     const [password, setPassword] = useState("");
//     const [roleType, setRoleType] = useState("student");
//     const [isMessageVisible, setIsMessageVisible] = useState(false);
//     const [message, setMessage] = useState({ title: "", text: "", type: "" });
//     const [isLoading, setIsLoading] = useState(false);

//     useEffect(() => {
//         setCredential("");
//         setHostelId("");
//         setPassword("");
//         setIsMessageVisible(false);
//     }, [roleType]);

//     const placeholder = roleType === 'student' ? "Student Email" : "Warden Email";

//     const handleLogin = async (e) => {
//         e.preventDefault();
//         setIsLoading(true);

//         if (!credential || !password || (roleType === 'student' && !hostelId)) {
//             setMessage({ title: "Login Failed", text: `Please fill in all required fields.`, type: "error" });
//             setIsMessageVisible(true);
//             setIsLoading(false);
//             return;
//         }

//         // --- ⬇️ HERE IS THE NEW VALIDATION BLOCK ⬇️ ---
//         const studentRegex = /^\S+@student\.usm\.my$/i; // Checks for 'xxx@student.usm.my'
//         const normalizedEmail = credential.toLowerCase();
//         let validationError = null;

//         if (roleType === 'student') {
//             if (!studentRegex.test(normalizedEmail)) {
//                 validationError = "Invalid Student Email. Must be in the format 'xxx@student.usm.my'.";
//             }
//         } else if (roleType === 'warden') {
//             if (studentRegex.test(normalizedEmail)) {
//                 // Fails if it's a student email but role is warden
//                 validationError = "Invalid Warden Email. Please use a '@usm.my' address, not a student email.";
//             } else if (!normalizedEmail.endsWith('@usm.my')) {
//                 // Fails if it's not a '@usm.my' address
//                 validationError = "Invalid Warden Email. Must be in the format 'xxx@usm.my'.";
//             }
//         }

//         if (validationError) {
//             setMessage({ title: "Validation Error", text: validationError, type: "error" });
//             setIsMessageVisible(true);
//             setIsLoading(false);
//             return; // Stop the function here
//         }
//         // --- ⬆️ END OF NEW VALIDATION BLOCK ⬆️ ---

//         // Cache the credentials immediately for potential Warden re-login/restoration
//         if (roleType === 'warden') {
//             wardenSessionCache.email = normalizedEmail;
//             wardenSessionCache.password = password;
//         }

//         try {
//             // Firebase Email/Password Authentication
//             await signInWithEmailAndPassword(auth, normalizedEmail, password);
//             //const userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
//             //const user = userCredential.user;

//             // Fetch user data from Firestore
//             //const userData = await fetchUserRole(user.uid, normalizedEmail);

//             setMessage({
//                 title: "Login Successful",
//                 text: `Welcome! Authenticating as ${normalizedEmail}...`,
//                 type: "success",
//             });
//             setIsMessageVisible(true);

//             setTimeout(() => {
//                 setIsMessageVisible(false);
//                 onLoginSuccess({
//                     role: userData.role,
//                     userDocId: userData.userDocId,
//                     mustChange: userData.mustChangePassword,
//                     userData: userData.userData
//                 });
//                 setIsLoading(false);
//             }, 1000);

//         } catch (error) {
//             console.error("Login error:", error);
//             let errorMessage = "Login failed. Please check your credentials.";

//             if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
//                 errorMessage = "Invalid email or password.";
//             } else if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-email') {
//                 errorMessage = "No account found with this email.";
//             }

//             setMessage({ title: "Login Failed", text: errorMessage, type: "error" });
//             setIsMessageVisible(true);
//             setIsLoading(false);
//         }
//     };

//     const closeMessage = () => setIsMessageVisible(false);

//     return (
//         <div 
//             className="relative flex flex-col items-center justify-center min-h-screen bg-gray-50 bg-cover bg-center p-4"
//             // Use the name of your image here
//             style={{ backgroundImage: "url('/login-bg.jpg')" }} 
//         >

//            {/* 2. OVERLAY (for readability) */}
//             <div className="absolute inset-0 bg-black opacity-50 z-0"></div>

//             {isMessageVisible && (
//                 <MessageBox
//                     title={message.title}
//                     text={message.text}
//                     type={message.type}
//                     onClose={closeMessage}
//                 />
//             )}

//             <div className="w-full max-w-md bg-white p-8 md:p-10 rounded-3xl shadow-2xl transition duration-500 transform hover:shadow-xl hover:scale-[1.01]">
//                 <div className="flex items-center justify-center mb-2">
//                     <Briefcase className="w-10 h-10 text-indigo-600 mr-3" />
//                     <h1 className="text-4xl font-extrabold text-gray-800 tracking-tight">HostelFix</h1>
//                 </div>
//                 <p className="text-center text-gray-500 mb-8 text-lg font-light">
//                     Sign in to manage facility issues.
//                 </p>

//                 <RoleToggle role={roleType} setRole={setRoleType} disabled={isLoading} />

//                 <form onSubmit={handleLogin}>
//                     {roleType === 'student' && (
//                         <InputField
//                             icon={Shield}
//                             type="text"
//                             placeholder="Hostel ID (e.g., A-101)"
//                             value={hostelId}
//                             onChange={(e) => setHostelId(e.target.value.toUpperCase())}
//                         />
//                     )}

//                     <InputField
//                         icon={Mail}
//                         type="email"
//                         placeholder={placeholder}
//                         value={credential}
//                         onChange={(e) => setCredential(e.target.value)}
//                         autoComplete="off"
//                     />

//                     <InputField
//                         icon={LogIn}
//                         type="password"
//                         placeholder="Password"
//                         value={password}
//                         onChange={(e) => setPassword(e.target.value)}
//                         autoComplete="new-password"
//                     />

//                     <div className="mt-8">
//                         <PrimaryButton type="submit" disabled={isLoading}>
//                             {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Sign In'}
//                         </PrimaryButton>
//                     </div>
//                 </form>

//                 <div className="mt-6 text-center text-sm">
//                     <button
//                         onClick={onForgotPassword}
//                         className="text-indigo-600 hover:text-indigo-800 transition duration-150 focus:outline-none"
//                         disabled={isLoading}
//                     >
//                         Forgot Password?
//                     </button>
//                 </div>

//                 <div className="mt-8 border-t pt-6 text-center">
//                     <p className="text-sm text-gray-500 mb-3">Any inquiries?</p>
//                     <div className="space-y-2">
//                         <a
//                             href="tel:+60123456789"
//                             className="flex items-center justify-center text-md font-semibold text-gray-700 hover:text-indigo-600 transition duration-150"
//                         >
//                             <User className="w-4 h-4 mr-2" /> Admin Office: +60 12-345 6789
//                         </a>
//                         <a
//                             href="tel:+60119876543"
//                             className="flex items-center justify-center text-md font-semibold text-gray-700 hover:text-indigo-600 transition duration-150"
//                         >
//                             <Phone className="w-4 h-4 mr-2" /> Technical Support: +60 11-987 6543
//                         </a>
//                     </div>
//                 </div>
//             </div>
//         </div>
//     );
// };

// export default LoginPage;
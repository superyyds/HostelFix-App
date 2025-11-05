import React, { useState } from "react";
import { LogIn, Home, Shield, AlertTriangle, MessageSquare, Briefcase, User, Mail, Users, Compass } from "lucide-react";

// --- Custom Components for Enhanced UI ---

// Reusable Button Component for a sleek, primary look
const PrimaryButton = ({ children, onClick, disabled = false, type = 'button', className = '' }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    type={type}
    className={`
      py-3 px-4 font-semibold text-lg tracking-wider
      bg-indigo-600 text-white rounded-lg shadow-lg
      transition duration-300 ease-in-out transform
      hover:bg-indigo-700 hover:shadow-xl active:scale-95
      disabled:bg-gray-400 disabled:shadow-none
      ${className}
    `}
  >
    {children}
  </button>
);

// Reusable Input Field for a clean, professional look
const InputField = ({ icon: Icon, type, placeholder, value, onChange }) => (
  <div className="relative mb-5">
    <Icon className="absolute top-1/2 left-4 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      required
      className="w-full py-3 pl-12 pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 shadow-sm"
    />
  </div>
);

// Role Selection Toggle
const RoleToggle = ({ role, setRole }) => (
  <div className="flex bg-gray-100 rounded-lg p-1 mb-8 shadow-inner">
    {['student', 'warden'].map((r) => (
      <button
        key={r}
        onClick={() => setRole(r)}
        className={`
          flex-1 py-2 text-sm font-semibold rounded-lg transition duration-300 ease-in-out
          ${role === r
            ? 'bg-indigo-600 text-white shadow-md'
            : 'text-gray-600 hover:bg-gray-200'
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

// Custom Message Box component
const MessageBox = ({ title, text, type, onClose }) => {
    const baseClasses = "fixed top-5 right-5 z-50 p-4 rounded-lg shadow-xl max-w-sm transition-all duration-300 transform";
    
    let colorClasses = "";
    let IconComponent = LogIn;

    switch (type) {
        case "success":
            colorClasses = "bg-green-100 border border-green-400 text-green-700";
            IconComponent = Home;
            break;
        case "error":
            colorClasses = "bg-red-100 border border-red-400 text-red-700";
            IconComponent = AlertTriangle;
            break;
        default:
            colorClasses = "bg-blue-100 border border-blue-400 text-blue-700";
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

// Placeholder Student Dashboard
const StudentDashboard = ({ onLogout }) => (
  <div className="p-8 bg-indigo-50 min-h-screen">
    <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-extrabold text-indigo-700 mb-6 border-b pb-2">Student Portal - HostelFix</h1>
        <div className="bg-white p-6 rounded-xl shadow-lg mb-8 flex justify-between items-center">
            <p className="text-lg text-gray-700">
                Welcome, Student! Get started by submitting a new complaint.
            </p>
            <PrimaryButton onClick={onLogout} className="w-auto px-6 bg-red-500 hover:bg-red-600 ml-4">
                <div className="flex items-center justify-center"><LogIn className="w-5 h-5 mr-2" /> Log Out</div>
            </PrimaryButton>
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
const WardenDashboard = ({ onLogout }) => (
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
  // Initialize from localStorage, fallback to 'login'
  const [view, setView] = useState(() => localStorage.getItem("userRole") || "login"); // 'login', 'student', 'warden'

  const handleLoginSuccess = (role) => {
    localStorage.setItem("userRole", role); // Save role persistently
    setView(role);
  };

  const handleLogout = () => {
    localStorage.removeItem("userRole"); // Clear persistent role on logout
    setView("login");
  };

  const renderView = () => {
    switch (view) {
      case "student":
        return <StudentDashboard onLogout={handleLogout} />;
      case "warden":
        return <WardenDashboard onLogout={handleLogout} />;
      case "login":
      default:
        return <LoginPage onLoginSuccess={handleLoginSuccess} />;
    }
  };

  return (
    <div className="min-h-screen font-sans">
      {renderView()}
    </div>
  );
};

export default App;

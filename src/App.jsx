import React, { useState } from "react";
import { LogIn, Home, Shield, AlertTriangle, MessageSquare, Briefcase, User, Mail, Users, Compass, Star, Send, Upload, Edit2, ArrowLeft } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";

// --- Custom Components for Enhanced UI ---

// Reusable Button Component for a sleek, primary look
export const PrimaryButton = ({
  children,
  onClick,
  disabled = false,
  type = "button",
  className = "",
  variant = "primary", // 'primary', 'secondary', 'danger', 'success'
  fullWidth = false,
}) => {
  // 🎨 Color Variants for different actions
  const variantClasses = {
    primary: "bg-indigo-600 hover:bg-indigo-700 text-white",
    secondary: "bg-gray-500 hover:bg-gray-600 text-white",
    success: "bg-green-500 hover:bg-green-600 text-white",
    danger: "bg-red-500 hover:bg-red-600 text-white",
  };

  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.03 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
      onClick={onClick}
      disabled={disabled}
      type={type}
      className={`
        ${fullWidth ? "w-full" : "w-auto"}
        ${variantClasses[variant]}
        py-3 px-5 rounded-xl font-semibold text-lg tracking-wide
        shadow-md transition-all duration-300 ease-in-out
        focus:outline-none focus:ring-4 focus:ring-indigo-300
        active:scale-95
        disabled:bg-gray-400 disabled:shadow-none disabled:cursor-not-allowed
        flex items-center justify-center gap-2
        ${className}
      `}
    >
      {children}
    </motion.button>
  );
};

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
            <PrimaryButton type="submit">
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

  const handleRating = (aspect, value) => {
    setRatings((prev) => ({ ...prev, [aspect]: value }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) setImage(URL.createObjectURL(file));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!feedbackText || Object.values(ratings).some((r) => r === 0)) {
      alert("Please rate all aspects and provide feedback.");
      return;
    }

    const avg =
      Object.values(ratings).reduce((a, b) => a + b, 0) / Object.keys(ratings).length;

    const feedback = {
      id: editingFeedback ? editingFeedback.id : Date.now(),
      feedbackText,
      ratings,
      averageRating: parseFloat(avg.toFixed(1)),
      image,
      createdAt: new Date().toLocaleString(),
      reviewed: false,
    };

    onSubmitFeedback(feedback);
    setFeedbackText("");
    setRatings({ responseTime: 0, serviceQuality: 0, communication: 0 });
    setImage(null);
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
            <PrimaryButton type="submit" className="bg-indigo-600 hover:bg-indigo-700">
              <Send className="w-5 h-5 mr-2 inline" />
              {editingFeedback ? "Update Feedback" : "Submit Feedback"}
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

// --- Feedback Viewer (Analytics) ---
export const FeedbackViewer = ({ feedbackList, onBack, onMarkReviewed }) => {
  const data = [1, 2, 3, 4, 5].map((r) => ({
    rating: r,
    count: feedbackList.filter((f) => Math.round(f.averageRating) === r).length,
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-sky-100 p-10">
      <div className="max-w-6xl mx-auto bg-white/95 backdrop-blur-md p-10 rounded-2xl shadow-lg border border-gray-100">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold text-indigo-700">Feedback Analytics</h2>
          <PrimaryButton onClick={onBack} className="bg-gray-400 hover:bg-gray-500">
            Back
          </PrimaryButton>
        </div>

        <div className="bg-gradient-to-r from-indigo-100 to-indigo-200 p-4 rounded-xl shadow-inner mb-8">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data}>
              <XAxis dataKey="rating" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#4F46E5" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-4">
          {feedbackList.map((fb) => (
            <motion.div
              key={fb.id}
              whileHover={{ scale: 1.01 }}
              className="border border-gray-200 p-5 rounded-xl flex justify-between items-center shadow-sm hover:shadow-md bg-white"
            >
              <div>
                <p className="text-gray-800 font-medium">{fb.feedbackText}</p>
                <p className="text-gray-400 text-xs">{fb.createdAt}</p>
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

// Placeholder Student Dashboard
const StudentDashboard = ({ onLogout, navigateToFeedback, navigateToFeedbackList }) => (
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
const WardenDashboard = ({ onLogout, navigateToFeedbackView }) => (
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
  const [view, setView] = useState("login"); // 'login', 'student', 'warden', etc.
  const [feedbackList, setFeedbackList] = useState([]);
  const [editingFeedback, setEditingFeedback] = useState(null); // NEW: track feedback being edited

  // --- Authentication ---
  const handleLoginSuccess = (role) => setView(role);
  const handleLogout = () => setView("login");

  // --- Feedback Functions ---
  const handleFeedbackSubmit = (feedback) => {
    if (editingFeedback) {
      // Update existing feedback
      setFeedbackList((prev) =>
        prev.map((f) => (f.id === feedback.id ? feedback : f))
      );
      setEditingFeedback(null);
    } else {
      // Add new feedback
      setFeedbackList((prev) => [...prev, feedback]);
    }
    setView("studentFeedbackList");
  };

  const handleDeleteFeedback = (id) => {
    setFeedbackList((prev) => prev.filter((f) => f.id !== id));
  };

  const handleEditFeedback = (feedback) => {
    setEditingFeedback(feedback);
    setView("feedbackForm");
  };

  const handleCancelEdit = () => {
    setEditingFeedback(null);
    setView("studentFeedbackList");
  };

  const handleMarkReviewed = (id) => {
    setFeedbackList((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, reviewed: true } : f
      )
    );
  };

  // --- View Controller ---
  const renderView = () => {
    switch (view) {
      case "student":
        return (
          <StudentDashboard
            navigateToFeedback={() => setView("feedbackForm")}
            navigateToFeedbackList={() => setView("studentFeedbackList")}
            onLogout={handleLogout}
          />
        );

      case "warden":
        return (
          <WardenDashboard
            navigateToFeedbackView={() => setView("feedbackViewer")}
            onLogout={handleLogout}
          />
        );

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
      {renderView()}
    </div>
  );
};

export default App;

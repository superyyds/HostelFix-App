import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { LogIn, Home, Shield, AlertTriangle, MessageSquare, Briefcase, User, Mail, Compass, X, Image as ImageIcon, CheckCircle, MapPin, Filter, SortAsc } from "lucide-react";

// --- Custom Components for Enhanced UI ---

// Reusable Button Component for a sleek, primary look
const PrimaryButton = ({ children, onClick, disabled = false, type = 'button', className = '' }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    type={type}
    className={`
      w-full py-3 px-4 font-semibold text-lg tracking-wider
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

  const handlePrev = () => setStep(s => Math.max(1, s - 1));

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
      attachments: images.map((f) => f.name),
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
                    {/* Status message */}
                        {isSubmitted && (
                          <div className="flex items-center gap-3 text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
                            <CheckCircle className="w-5 h-5" />
                            <span className="font-medium">Submitted successfully — returning to list...</span>
                          </div>
                        )}

                     <div className="p-6">
                       <h3 className="text-2xl font-semibold text-indigo-700 mb-2">Review & Confirm</h3>
                       <p className="text-lg text-gray-600 mb-6">Please verify all details before submitting.</p>

                      {/* Complaint Ticket */}
                      <div className="overflow-y-auto p-4 flex justify-center">
                        <div className="w-full max-w-3xl bg-white border border-gray-200 shadow-lg rounded-2xl overflow-hidden">
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
                  </div>
                )}
              </motion.div>
            </div>

            {/* bottom quick controls */}
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-gray-500">Need help? Contact the warden for urgent issues.</div>
              <div className="flex items-center gap-5">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="px-6 py-3 rounded border text-gray-700 hover:bg-gray-100 transition"
                  >
                    Back
                  </button>
                ) : (
                  <div />
                )}

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
const ComplaintList = ({ list, onSelect, title = "Complaints" }) => {
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
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      {/* ===== HEADER ===== */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-3">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <span className="inline-block w-2 h-6 bg-indigo-600 rounded"></span>
          {title}
        </h2>

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
  );
};

// Complaint detail + actions
const ComplaintDetail = ({ complaint, currentUser, onClose, onUpdate }) => {
  const [remarks, setRemarks] = useState('');
  const [assignedTo, setAssignedTo] = useState(complaint.assignedTo || '');
  const [status, setStatus] = useState(complaint.status);

  if (!complaint) return null;
  const isWarden = currentUser.role === 'warden';
  const canResolve = isWarden || (complaint.userId === currentUser.id);

  const applyUpdate = () => {
    const updates = {};
    if (assignedTo !== complaint.assignedTo) updates.assignedTo = assignedTo || null;
    if (status !== complaint.status) {
      updates.status = status;
      if (status === STATUS.RESOLVED) updates.dateResolved = new Date().toISOString();
      else updates.dateResolved = null;
    }
    if (remarks.trim()) updates.remarks = (complaint.remarks ? complaint.remarks + '\n' : '') + `${currentUser.name}: ${remarks}`;
    onUpdate(complaint._id, updates);
    setRemarks('');
  };

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center p-6">
      <div className="w-full max-w-3xl bg-white rounded-lg shadow-xl p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-900">Close</button>
        <h3 className="text-2xl font-bold mb-2">{complaint.category} — {complaint.priority}</h3>
        <div className="text-sm text-gray-600 mb-3">Submitted by: {complaint.userName} • {new Date(complaint.dateSubmitted).toLocaleString()}</div>
        <p className="mb-4">{complaint.description}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <div className="text-xs text-gray-500">Status</div>
            <div className="font-medium mb-2">{complaint.status}</div>

            <div className="text-xs text-gray-500">Assigned To</div>
            <div className="font-medium mb-2">{complaint.assignedTo || 'Unassigned'}</div>

            <div className="text-xs text-gray-500">Attachments</div>
            <div className="text-sm mb-2">{complaint.attachments.length ? complaint.attachments.join(', ') : '—'}</div>

            <div className="text-xs text-gray-500">Remarks / History</div>
            <pre className="text-sm p-2 bg-gray-50 rounded h-28 overflow-auto">{complaint.remarks || 'No remarks yet.'}</pre>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Add remark</label>
            <textarea value={remarks} onChange={e=>setRemarks(e.target.value)} className="w-full p-2 border rounded mb-3" rows={4} />

            <label className="block text-sm font-medium mb-1">Change status</label>
            <select value={status} onChange={e=>setStatus(e.target.value)} className="w-full mb-3 p-2 border rounded">
              <option>{STATUS.PENDING}</option>
              <option>{STATUS.IN_PROGRESS}</option>
              <option>{STATUS.RESOLVED}</option>
            </select>

            {isWarden && (
              <>
                <label className="block text-sm font-medium mb-1">Assign to (staff name)</label>
                <input value={assignedTo} onChange={e=>setAssignedTo(e.target.value)} className="w-full mb-3 p-2 border rounded" placeholder="Enter staff name to assign" />
              </>
            )}

            <div className="flex gap-3">
              <PrimaryButton onClick={applyUpdate}>Apply</PrimaryButton>
              <button onClick={onClose} className="px-4 py-2 rounded border text-gray-700">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Placeholder Student Dashboard
const StudentDashboard = ({ currentUser, complaints, onCreateComplaint, onUpdateComplaint, onLogout }) => {
  const [page, setPage] = useState('my'); // 'register' | 'my' | 'history'
  const [selected, setSelected] = useState(null);

  return (
    <div className="p-8 bg-indigo-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-extrabold text-indigo-700">Student Portal - HostelFix</h1>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-700">Signed in as <strong>{currentUser.name}</strong></div>
            <PrimaryButton onClick={onLogout} className="w-auto px-4 bg-red-500 hover:bg-red-600">
              <div className="flex items-center"><LogIn className="w-4 h-4 mr-2" /> Log Out</div>
            </PrimaryButton>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <DashboardCard icon={MessageSquare} title="My Complaints" description="Track progress of complaints you submitted." color="text-blue-500" onClick={()=>setPage('my')} />
          <DashboardCard icon={AlertTriangle} title="Register Complaint" description="Log a new issue with room or facilities." color="text-red-500" onClick={()=>setPage('register')} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            {page === 'my' && (
              <ComplaintList list={complaints} filter={{ userId: currentUser.id }} onSelect={c=>setSelected(c)} title="My Complaints" />
            )}
            {page === 'register' && <ComplaintForm currentUser={currentUser} onCreate={onCreateComplaint} onClose={() => setPage('my')} />}
          </div>
        </div>

      </div>

      {selected && <ComplaintDetail complaint={selected} currentUser={currentUser} onClose={()=>setSelected(null)} onUpdate={onUpdateComplaint} />}
    </div>
  );
};

// Placeholder Warden Dashboard
const WardenDashboard = ({ currentUser, complaints, onUpdateComplaint, onLogout }) => {
  const [view, setView] = useState('new'); // 'new' | 'all' | 'inprogress'
  const [selected, setSelected] = useState(null);

  const counts = useMemo(() => ({
    newCount: complaints.filter(c=>c.status===STATUS.PENDING).length,
    inProgress: complaints.filter(c=>c.status===STATUS.IN_PROGRESS).length,
    resolved: complaints.filter(c=>c.status===STATUS.RESOLVED).length
  }), [complaints]);

  return (
    <div className="p-8 bg-gray-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-extrabold text-gray-800">Warden Portal - HostelFix Management</h1>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-700">Signed in as <strong>{currentUser.name}</strong></div>
            <PrimaryButton onClick={onLogout} className="w-auto px-4 bg-red-500 hover:bg-red-600">
              <div className="flex items-center"><LogIn className="w-4 h-4 mr-2" /> Log Out</div>
            </PrimaryButton>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <DashboardCard icon={AlertTriangle} title={`New Complaints (${counts.newCount})`} description="Assign unhandled issues." color="text-red-500" onClick={()=>setView('new')} />
          <DashboardCard icon={MessageSquare} title={`In Progress (${counts.inProgress})`} description="Work currently being handled." color="text-indigo-500" onClick={()=>setView('inprogress')} />
          <DashboardCard icon={Shield} title={`Resolved (${counts.resolved})`} description="Completed jobs & history." color="text-green-500" onClick={()=>setView('all')} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <ComplaintList list={complaints} filter={view==='new' ? { status: STATUS.PENDING } : view==='inprogress' ? { status: STATUS.IN_PROGRESS } : {}} onSelect={c=>setSelected(c)} title={view === 'new' ? 'New / Unassigned' : view === 'inprogress' ? 'In Progress' : 'All Complaints'} />
          </div>
        </div>

      </div>

      {selected && <ComplaintDetail complaint={selected} currentUser={currentUser} onClose={()=>setSelected(null)} onUpdate={onUpdateComplaint} />}
    </div>
  );
};

// --- Main App Component ---

const App = () => {
  const [view, setView] = useState("login"); // 'login', 'student', 'warden'
  // simple "current user" mock
  const [currentUser, setCurrentUser] = useState(null);

  // in-memory complaints store
  const [complaints, setComplaints] = useState([
    // sample seed
    {
      _id: makeId(),
      userId: 'u1',
      userName: 'Alice Student',
      campus: 'Main Campus',
      hostel: 'FAJAR HARAPAN',
      category: 'Plumbing',
      description: 'Leaky tap in bathroom 203.',
      priority: 'High',
      status: STATUS.PENDING,
      remarks: '',
      attachments: [],
      dateSubmitted: new Date(Date.now()-1000*60*60*24).toISOString(),
      dateResolved: null,
      assignedTo: null
    }
  ]);

  const handleLoginSuccess = (role, name='Student User') => {
    setCurrentUser({ id: role === 'student' ? 'u1' : 'warden1', role, name: role === 'student' ? name : 'Warden User' });
    setView(role);
  };

  const handleLogout = () => {
    setView("login");
    setCurrentUser(null);
  };

  const createComplaint = (c) => {
    setComplaints(prev => [c, ...prev]);
  };

  const updateComplaint = (id, updates) => {
    setComplaints(prev => prev.map(c => c._id === id ? { ...c, ...updates } : c));
  };

  const renderView = () => {
    switch (view) {
      case "student":
        return <StudentDashboard currentUser={currentUser} complaints={complaints} onCreateComplaint={createComplaint} onUpdateComplaint={updateComplaint} onLogout={handleLogout} />;
      case "warden":
        return <WardenDashboard currentUser={currentUser} complaints={complaints} onUpdateComplaint={updateComplaint} onLogout={handleLogout} />;
      case "login":
      default:
        return <LoginPage onLoginSuccess={(role) => handleLoginSuccess(role, role === 'student' ? 'Alice Student' : 'Warden User')} />;
    }
  };

  return (
    <div className="min-h-screen font-sans">
      {renderView()}
    </div>
  );
};

export default App;

import React, { useState, } from "react";
import { motion } from "framer-motion";
import { CheckCircle, Image as ImageIcon } from "lucide-react";

import PrimaryButton from "../components/PrimaryButton";

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
      userId: currentUser.userId,
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

    setTimeout(() => {
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

export default ComplaintForm;
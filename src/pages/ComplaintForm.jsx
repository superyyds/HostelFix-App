import React, { useState, } from "react";
import { motion } from "framer-motion";
import { CheckCircle, ImageIcon, Blocks, ShieldAlert, Clipboard, Waves, Zap, MessageCircleQuestion, Bed, Home, Trash, AlertTriangle } from "lucide-react";
import { collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";

import { db } from "../api/firebase"; 
import PrimaryButton from "../components/PrimaryButton";
import MessageBox from "../components/MessageBox";
import { notifyWardenNewComplaint } from "../api/notifications";

const STATUS = { PENDING: 'Pending', IN_PROGRESS: 'In Progress', RESOLVED: 'Resolved' };

// Complaint Form component (common)
const ComplaintForm = ({ currentUser, onCreate, onClose }) => {
  const [step, setStep] = useState(1);
  const [campus, setCampus] = useState("");
  const [hostel, setHostel] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [images, setImages] = useState([]);
  const [messageBox, setMessageBox] = useState({ visible: false, type: "", title: "", text: "" });

  const campusOptions = {
    "Main Campus": {
      hostels: {
        "AMAN DAMAI": {
          image: "/images/hostels/aman-damai.jpeg",
          logo: "/images/logos/aman-damai-logo.jpg"
        },
        "BAKTI PERMAI": {
          image: "/images/hostels/bakti-permai.jpeg",
          logo: "/images/logos/bakti-permai-logo.jpeg"
        },
        "CAHAYA GEMILANG": {
          image: "/images/hostels/cahaya-gemilang.jpeg",
          logo: "/images/logos/cahaya-gemilang-logo.jpeg"
        },
        "FAJAR HARAPAN": {
          image: "/images/hostels/fajar-harapan.jpeg",
          logo: "/images/logos/fajar-harapan-logo.png"
        },
        "INDAH KEMBARA": {
          image: "/images/hostels/indah-kembara.jpeg",
          logo: "/images/logos/indah-kembara-logo.jpeg"
        },
        "RESTU": {
          image: "/images/hostels/restu.jpeg",
          logo: "/images/logos/restu-logo.png"
        },
        "SAUJANA": {
          image: "/images/hostels/saujana.jpeg",
          logo: "/images/logos/saujana-logo.jpeg"
        },
        "TEKUN": {
          image: "/images/hostels/tekun.jpeg",
          logo: "/images/logos/tekun-logo.jpeg"
        }
      },
      image: "/images/campuses/main-campus.jpeg"
    },
    "Engineering Campus": {
      hostels: {
        "UTAMA": {
          image: "/images/hostels/utama.jpeg",
          logo: "/images/logos/utama-logo.jpeg"
        },
        "LEMBARAN": {
          image: "/images/hostels/lembaran.jpeg",
          logo: "/images/logos/lembaran-logo.png"
        },
        "JAYA": {
          image: "/images/hostels/jaya.jpeg",
          logo: "/images/logos/jaya-logo.jpeg"
        }
      },
      image: "/images/campuses/engineering-campus.jpeg"
    },
    "Health Campus": {
      hostels: {
        "MURNI": {
          image: "/images/hostels/murni.jpeg",
          logo: "/images/logos/murni-nurani-logo.png"
        },
        "NURANI": {
          image: "/images/hostels/nurani.jpeg",
          logo: "/images/logos/murni-nurani-logo.png"
        }
      },
      image: "/images/campuses/health-campus.jpeg"
    }
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

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    setIsSubmitting(true);

    try {
        // convert attachments to data URLs (or [] if none)
        const attachments = images && images.length
          ? await Promise.all(
              images.map(file => new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                  // Store only the data URL string, not complex objects
                  resolve(reader.result);
                };
                reader.onerror = (err) => reject(err);
                reader.readAsDataURL(file);
              }))
            )
          : [];

        const doc = {
        userId: currentUser.uid || "unknown",
        userName: currentUser.name || "Unknown",
        campus,
        hostel,
        category,
        description,
        priority,
        status: STATUS.PENDING,
        remarks: "",
        attachments,
        dateSubmitted: serverTimestamp(),
        dateResolved: null,
        assignedTo: null,
        };

        // write to Firestore
        const colRef = collection(db, "complaints");
        const ref = await addDoc(colRef, doc);

        // 🔔 NOTIFICATION: Notify warden about new complaint
        try {
          // Find warden(s) - you might want to notify all wardens or specific ones
          const wardensQuery = query(collection(db, "users"), where("role", "==", "warden"));
          const wardenSnapshot = await getDocs(wardensQuery);
          
          // Notify all wardens
          const notificationPromises = wardenSnapshot.docs.map(wardenDoc => {
            const wardenData = wardenDoc.data();
            // Always use the document ID as it matches the Auth UID
            const wardenId = wardenDoc.id;
            
            console.log('🔍 DEBUG: Notifying warden:', wardenId, 'Name:', wardenData.name);
            
            return notifyWardenNewComplaint({
              complaintId: ref.id,
              userName: currentUser.name || "Unknown",
              category,
              priority,
              campus,
              hostel
            }, wardenId);
          });
          
          await Promise.all(notificationPromises);
          console.log('✅ Warden(s) notified about new complaint');
        } catch (notifError) {
          console.error('⚠️ Failed to send notifications:', notifError);
          // Don't fail the complaint submission if notification fails
        }

        // optional: attach the generated id locally (if you want)
        const created = { 
          ...doc, 
          _id: ref.id, 
          dateSubmitted: new Date().toISOString(),
          // Reconstruct the attachment objects for local state if needed
          attachments: attachments.map((dataUrl, index) => ({
            name: images[index]?.name || `attachment-${index}`,
            dataUrl: dataUrl
          }))
        };
        
        // call local callback to update local state / UI
        onCreate(created);

        // Show success notification
        setMessageBox({
          visible: true,
          type: "success",
          title: "Complaint Submitted!",
          text: "Complaint submitted successfully! The warden has been notified."
        });

        setTimeout(() => {
            onClose();
            // reset form
            setStep(1); setCampus(''); setHostel(''); setCategory(''); setDescription(''); setPriority('Medium'); setImages([]);
        }, 1200);

        // Auto-hide notification after 5 seconds
        setTimeout(() => {
          setMessageBox({ visible: false, type: "", title: "", text: "" });
        }, 5000);
    } catch (err) {
        console.error("Failed to submit complaint:", err);
        setMessageBox({
          visible: true,
          type: "error",
          title: "Submission Failed",
          text: "Failed to submit complaint. Please try again."
        });
        // Auto-hide error notification after 5 seconds
        setTimeout(() => {
          setMessageBox({ visible: false, type: "", title: "", text: "" });
        }, 5000);
    } finally {
        setIsSubmitting(false);
    }
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
                  <div className="h-full">
                    <div className="p-6">
                      {/* Campus Selection */}
                      <div className="mb-12">
                        <h3 className="text-2xl font-semibold text-indigo-700 mb-2">Select Your Campus</h3>
                        <p className="text-lg text-gray-600 mb-8">Choose the campus where your hostel is located</p>

                        {/* Campus Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {Object.entries(campusOptions).map(([campusName, campusData]) => (
                            <motion.div
                              key={campusName}
                              whileHover={{ scale: 1.03, y: -5 }}
                              whileTap={{ scale: 0.98 }}
                              className={`relative cursor-pointer rounded-2xl overflow-hidden border-2 transition-all duration-300 ${
                                campus === campusName 
                                  ? 'border-indigo-500 ring-4 ring-indigo-100 shadow-xl' 
                                  : 'border-gray-200 hover:border-indigo-300 shadow-lg hover:shadow-xl'
                              }`}
                              onClick={() => {
                                setCampus(campusName);
                                setHostel('');
                              }}
                            >
                              {/* Campus Image */}
                              <div className="relative h-48 overflow-hidden">
                                <img
                                  src={campusData.image}
                                  alt={campusName}
                                  className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
                                />
                                {/* Overlay */}
                                <div className={`absolute inset-0 bg-gradient-to-t from-black/70 to-transparent transition-opacity duration-300 ${
                                  campus === campusName ? 'opacity-80' : 'opacity-60'
                                }`} />
                                
                                {/* Campus Name */}
                                <div className="absolute bottom-4 left-4 text-white">
                                  <h4 className="text-xl font-bold">{campusName}</h4>
                                </div>

                                {/* Selection Indicator */}
                                {campus === campusName && (
                                  <motion.div 
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="absolute top-4 right-4"
                                  >
                                    <div className="bg-indigo-500 text-white p-2 rounded-full shadow-lg">
                                      <CheckCircle className="w-5 h-5" />
                                    </div>
                                  </motion.div>
                                )}
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>

                      {/* Hostel Selection */}
                      {campus && (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5 }}
                        >
                          <h3 className="text-2xl font-semibold text-indigo-700 mb-2">Select Your Hostel</h3>
                          <p className="text-lg text-gray-600 mb-8">Choose your specific hostel in {campus}</p>

                          {/* Hostel Cards */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {Object.entries(campusOptions[campus].hostels).map(([hostelName, hostelData]) => (
                              <motion.div
                                key={hostelName}
                                whileHover={{ scale: 1.05, y: -5 }}
                                whileTap={{ scale: 0.95 }}
                                className={`relative cursor-pointer rounded-xl overflow-hidden border-2 transition-all duration-300 ${
                                  hostel === hostelName 
                                    ? 'border-indigo-500 ring-4 ring-indigo-100 shadow-lg' 
                                    : 'border-gray-200 hover:border-indigo-300 shadow-md hover:shadow-lg'
                                }`}
                                onClick={() => setHostel(hostelName)}
                              >
                                {/* Hostel Image */}
                                <div className="relative h-32 overflow-hidden">
                                  <img
                                    src={hostelData.image}
                                    alt={hostelName}
                                    className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
                                  />
                                  {/* Overlay */}
                                  <div className={`absolute inset-0 bg-gradient-to-t from-black/60 to-transparent transition-opacity duration-300 ${
                                    hostel === hostelName ? 'opacity-70' : 'opacity-50'
                                  }`} />
                                  
                                  {/* Hostel Logo */}
                                  {hostelData.logo && (
                                    <div className="absolute top-2 left-2 w-10 h-10 bg-white rounded-lg p-1 shadow-md">
                                      <img
                                        src={hostelData.logo}
                                        alt={`${hostelName} logo`}
                                        className="w-full h-full object-contain"
                                      />
                                    </div>
                                  )}

                                  {/* Selection Indicator */}
                                  {hostel === hostelName && (
                                    <motion.div 
                                      initial={{ scale: 0 }}
                                      animate={{ scale: 1 }}
                                      className="absolute top-2 right-2"
                                    >
                                      <div className="bg-indigo-500 text-white p-1 rounded-full shadow-lg">
                                        <CheckCircle className="w-4 h-4" />
                                      </div>
                                    </motion.div>
                                  )}
                                </div>

                                {/* Hostel Name */}
                                <div className="p-3 bg-white">
                                  <h4 className="font-semibold text-gray-800 text-center">{hostelName}</h4>
                                </div>
                              </motion.div>
                            ))}
                          </div>

                          {/* Selected Hostel Preview */}
                          {hostel && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="mt-8 p-6 bg-gradient-to-r from-indigo-50 to-emerald-50 rounded-2xl border border-indigo-200"
                            >
                              <div className="flex items-center gap-4">
                                <div className="w-16 h-16 bg-white rounded-xl p-2 shadow-md">
                                  <img
                                    src={campusOptions[campus].hostels[hostel].logo}
                                    alt={`${hostel} logo`}
                                    className="w-full h-full object-contain"
                                  />
                                </div>
                                <div>
                                  <h4 className="text-xl font-bold text-indigo-800">Selected: Desasiswa {hostel}</h4>
                                  <p className="text-indigo-600">Located at {campus}</p>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </motion.div>
                      )}
                    </div>
                  </div>
                )}

                {/* Step 2 */}
                {step === 2 && (
                  <form className="h-full grid grid-cols-1 gap-8" onSubmit={(e) => { e.preventDefault(); handleNext(); }}>
                    <div className="p-6">
                      <h3 className="text-2xl font-semibold text-indigo-700 mb-2">Complaint Information</h3>
                      <p className="text-lg text-gray-600 mb-8">Fill required fields and attach images (photo of issue recommended).</p>

                      {/* Category Selection */}
                      <div className="mb-8">
                        <label className="block mb-3 font-medium text-lg flex items-center gap-2">
                          <Blocks className="w-6 h-6 text-indigo-600" />
                          Category
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[
                          { 
                            id: "Plumbing", 
                            icon: <Waves className="w-6 h-6" />,
                            description: "Water pipes, leaks, drainage, and bathroom issues"
                          },
                          { 
                            id: "Electrical", 
                            icon: <Zap className="w-6 h-6" />,
                            description: "Lights, power outlets, switches, and electrical systems"
                          },
                          { 
                            id: "Furniture", 
                            icon: <Bed className="w-6 h-6" />,
                            description: "Beds, chairs, tables, wardrobes, and room furnishings"
                          },
                          { 
                            id: "Room", 
                            icon: <Home className="w-6 h-6" />,
                            description: "Room structure, doors, windows, walls, and ceilings"
                          },
                          { 
                            id: "Cleanliness", 
                            icon: <Trash className="w-6 h-6" />,
                            description: "Cleaning, sanitation, pest control, and hygiene issues"
                          },
                          { 
                            id: "Other", 
                            icon: <MessageCircleQuestion className="w-6 h-6" />,
                            description: "Any other issues not covered by the categories above"
                          }
                        ].map((cat) => (
                          <motion.div
                            key={cat.id}
                            whileHover={{ y: -4 }}
                            className={`cursor-pointer rounded-xl border-2 p-5 transition-all duration-300 ${
                              category === cat.id
                                ? 'border-indigo-500 bg-indigo-50 shadow-lg ring-1 ring-indigo-200'
                                : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-md'
                            }`}
                            onClick={() => setCategory(cat.id)}
                          >
                            {/* Header with Icon and Title */}
                            <div className="flex items-start gap-3 mb-3">
                              <div className={`p-2 rounded-lg ${
                                category === cat.id ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-600'
                              }`}>
                                {cat.icon}
                              </div>
                              <div className="flex-1">
                                <h4 className={`font-semibold text-lg ${
                                  category === cat.id ? 'text-indigo-700' : 'text-gray-800'
                                }`}>
                                  {cat.id}
                                </h4>
                              </div>
                              {category === cat.id && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="bg-indigo-500 text-white p-1 rounded-full"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </motion.div>
                              )}
                            </div>

                            {/* Description */}
                            <p className="text-sm text-gray-600 mb-3 leading-relaxed">
                              {cat.description}
                            </p>

                          </motion.div>
                        ))}
                      </div>
                      </div>

                      {/* Priority Selection */}
                      <div className="mb-8">
                        <label className="block mb-3 font-medium text-lg flex items-center gap-2">
                          <ShieldAlert className="w-6 h-6 text-indigo-600" />
                          Urgency Level
                        </label>
                        <div className="flex flex-wrap justify-center gap-6">
                          {[
                            { 
                              id: "Low", 
                              color: "bg-green-100 text-green-800 border-green-300",
                              selectedColor: "bg-green-500 text-white border-green-600",
                              description: "Minor issue, can wait"
                            },
                            { 
                              id: "Medium", 
                              color: "bg-yellow-100 text-yellow-800 border-yellow-300",
                              selectedColor: "bg-yellow-500 text-white border-yellow-600",
                              description: "Moderate issue, address soon"
                            },
                            { 
                              id: "High", 
                              color: "bg-red-100 text-red-800 border-red-300",
                              selectedColor: "bg-red-500 text-white border-red-600",
                              description: "Urgent issue, needs immediate attention"
                            }
                          ].map((prio) => (
                            <motion.button
                              key={prio.id}
                              type="button"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              className={`w-36 px-6 py-3 rounded-full border-2 font-semibold transition-all duration-300 ${
                                priority === prio.id 
                                  ? prio.selectedColor + ' shadow-lg ring-2 ring-opacity-30 ' + 
                                    (prio.id === "High" ? "ring-red-300" : 
                                    prio.id === "Medium" ? "ring-yellow-300" : "ring-green-300")
                                  : prio.color + ' hover:shadow-md'
                              }`}
                              onClick={() => setPriority(prio.id)}
                            >
                              {prio.id}
                            </motion.button>
                          ))}
                        </div>
                        
                        {/* Priority Description */}
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-600 text-center">
                            {priority === "Low" ? "🟢 Low Urgency - Minor issue that can be addressed when convenient" :
                            priority === "Medium" ? "🟡 Medium Urgency - Should be addressed within a few days" :
                            "🔴 High Urgency - Requires immediate attention and resolution"}
                          </p>
                        </div>
                      </div>

                      {/* Description */}
                      <div className="mb-8">
                        <label className="block mb-3 font-medium text-lg flex items-center gap-2">
                          <Clipboard className="w-6 h-6 text-indigo-600" />
                          Description
                        </label>
                        <textarea 
                          value={description} 
                          onChange={(e) => setDescription(e.target.value)} 
                          rows={6} 
                          className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-300"
                          placeholder="Please describe the issue in detail including specific locations, what happened, and when it started."
                        ></textarea>
                        <p className="text-sm text-gray-500 mt-2">
                          Be as detailed as possible to help us understand and resolve your issue quickly.
                        </p>
                      </div>

                      {/* Image Upload */}
                      <div className="mb-6">
                        <label className="block mb-3 font-medium text-lg flex items-center gap-2">
                          <ImageIcon className="w-6 h-6 text-indigo-600" /> 
                          Upload Images
                        </label>
                        <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-indigo-400 transition-colors duration-300">
                          <input 
                            type="file" 
                            multiple 
                            accept="image/*" 
                            onChange={(e) => setImages(prev => [...prev, ...Array.from(e.target.files)])} 
                            className="hidden" 
                            id="image-upload"
                          />
                          <label 
                            htmlFor="image-upload" 
                            className="cursor-pointer block"
                          >
                            <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                            <p className="text-gray-600 mb-2">Click to upload images or drag and drop</p>
                            <p className="text-sm text-gray-500">PNG, JPG, JPEG up to 10MB each</p>
                          </label>
                        </div>
                        
                        {/* Image Preview */}
                        {images.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-4"
                          >
                            <h4 className="font-medium text-gray-700 mb-3">Selected Images ({images.length})</h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                              {images.map((file, index) => (
                                <div key={index} className="relative group">
                                  <img
                                    src={URL.createObjectURL(file)}
                                    alt={`Preview ${index + 1}`}
                                    className="w-full h-24 object-cover rounded-lg border border-gray-200"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setImages(images.filter((_, i) => i !== index))}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                  >
                                    ×
                                  </button>
                                  <p className="text-xs text-gray-500 mt-1 truncate">{file.name}</p>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </div>
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
                  <PrimaryButton 
                    onClick={handleSubmit} 
                    className="w-auto px-6"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Submitting...
                      </div>
                    ) : (
                      "Submit"
                    )}
                  </PrimaryButton>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Message Box */}
      {messageBox.visible && (
        <div className="fixed top-4 right-4 z-50 max-w-sm w-full p-2">
          <MessageBox
            title={messageBox.title}
            text={messageBox.text}
            type={messageBox.type}
            onClose={() => setMessageBox({ visible: false, type: "", title: "", text: "" })}
            className="pointer-events-auto"
          />
        </div>
      )}
    </div>
  );
};

export default ComplaintForm;
import React from 'react';
import { LogIn, Home, AlertTriangle, Compass } from "lucide-react"; // Icons for different message types

const MessageBox = ({ title, text, type, onClose }) => {
  const baseClasses = "fixed top-5 right-5 z-50 p-4 rounded-lg shadow-2xl max-w-sm transition-all duration-300 transform";

  let colorClasses = "";
  let IconComponent = LogIn; // Default icon

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
          {/* Close icon (custom SVG) */}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
        </div>
      <p className="mt-2 text-sm">{text}</p>
    </div>
  );
};

export default MessageBox;
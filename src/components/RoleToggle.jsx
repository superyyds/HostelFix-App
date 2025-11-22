import React from 'react';
import { User, Briefcase, Shield } from "lucide-react";

const RoleToggle = ({ role, setRole, disabled = false }) => (
  <div className={`flex bg-gray-100 rounded-xl p-1 mb-8 shadow-inner`}>
    {['student', 'staff', 'warden'].map((r) => (
      <button
        key={r}
        type="button" // 🔑 CRITICAL: This prevents Enter key from "clicking" this button
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
          {r === 'student' 
            ? <User className="w-4 h-4 mr-2" /> 
            : r === 'warden' 
            ? <Briefcase className="w-4 h-4 mr-2" /> 
            : <Shield className="w-4 h-4 mr-2" />
          } 
          {r}
        </div>
      </button>
    ))}
  </div>
);

export default RoleToggle;

// import React from 'react';
// import { User, Briefcase, Shield } from "lucide-react"; // 🔑 ADDED: Shield icon for staff

// const RoleToggle = ({ role, setRole, disabled = false }) => (
//   <div className={`flex bg-gray-100 rounded-xl p-1 mb-8 shadow-inner`}>
//     {/* 🔑 MODIFIED: Added 'staff' to the array */}
//     {['student', 'staff', 'warden'].map((r) => (
//       <button
//         key={r}
//         onClick={() => setRole(r)}
//         disabled={disabled}
//         className={`
//           flex-1 py-2 text-base font-semibold rounded-xl transition duration-300 ease-in-out
//           ${role === r
//             ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/50 transform scale-[1.02]'
//             : 'text-gray-600 hover:bg-white/70'
//           }
//         `}
//       >
//         <div className="flex items-center justify-center capitalize">
//           {/* 🔑 MODIFIED: Added conditional rendering for the 'staff' icon */}
//           {r === 'student' 
//             ? <User className="w-4 h-4 mr-2" /> 
//             : r === 'warden' 
//             ? <Briefcase className="w-4 h-4 mr-2" /> 
//             : <Shield className="w-4 h-4 mr-2" /> // Display Shield for staff
//           } 
//           {r}
//         </div>
//       </button>
//     ))}
//   </div>
// );

// export default RoleToggle;
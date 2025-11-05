import React from 'react';
import { User, Briefcase } from "lucide-react"; // Icons needed for this component

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
          {r === 'student' ? <User className="w-4 h-4 mr-2" /> : <Briefcase className="w-4 h-4 mr-2" />} {r}
        </div>
      </button>
    ))}
  </div>
);

export default RoleToggle;
import React from 'react';

// The Icon is passed in via props (e.g., AlertTriangle, MessageSquare)

const DashboardCard = ({ icon: Icon, title, description, color, onClick = () => {} }) => (
  <button
    onClick={onClick}
    className="w-full text-left bg-white p-6 rounded-2xl shadow-xl transition duration-300 ease-in-out transform hover:scale-[1.02] hover:shadow-2xl border-t-4 border-indigo-500 hover:border-t-indigo-600"
  >
    {/* Icon passed as prop is used here */}
    <Icon className={`w-8 h-8 mb-4 ${color}`} /> 
    <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
    <p className="text-gray-600 text-sm">{description}</p>
  </button>
);

export default DashboardCard;
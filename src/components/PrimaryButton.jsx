import React from 'react';

const PrimaryButton = ({ children, onClick, disabled = false, type = 'button', className = '' }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    type={type}
    className={`
      w-full py-3 px-4 font-semibold text-lg tracking-wider
      bg-indigo-600 text-white rounded-xl shadow-xl
      transition duration-300 ease-in-out transform
      hover:bg-indigo-700 hover:shadow-2xl active:scale-[0.98]
      disabled:bg-gray-400 disabled:shadow-none
      ${className}
    `}
  >
    {children}
  </button>
);

export default PrimaryButton;
import React from 'react';

const InfoRow = ({ label, value }) => (
  <div className="flex justify-between">
    <span className="font-medium">{label}:</span>
    <span className="text-gray-800">{value}</span>
  </div>
);

export default InfoRow;
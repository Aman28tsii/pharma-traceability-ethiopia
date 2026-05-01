// EmptyState.jsx
import React from 'react';
const EmptyState = ({ title, description }) => (
  <div className="text-center py-12">
    <p className="text-gray-500">{title || 'No data'}</p>
  </div>
);
export default EmptyState;
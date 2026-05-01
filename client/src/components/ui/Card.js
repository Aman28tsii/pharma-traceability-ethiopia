import React from 'react';

const Card = ({ children, className = '', padding = true, hover = false }) => {
  return (
    <div 
      className={`
        bg-white dark:bg-gray-800 rounded-xl shadow-sm
        ${padding ? 'p-4 sm:p-6' : ''}
        ${hover ? 'transition-all duration-200 hover:shadow-md hover:-translate-y-0.5' : ''}
        border border-gray-100 dark:border-gray-700
        ${className}
      `}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ children, className = '' }) => (
  <div className={`mb-4 pb-3 border-b border-gray-100 dark:border-gray-700 ${className}`}>
    {children}
  </div>
);

export const CardTitle = ({ children, className = '' }) => (
  <h3 className={`text-lg font-semibold text-gray-900 dark:text-white ${className}`}>
    {children}
  </h3>
);

export const CardContent = ({ children, className = '' }) => (
  <div className={`text-gray-700 dark:text-gray-300 ${className}`}>
    {children}
  </div>
);

export default Card;
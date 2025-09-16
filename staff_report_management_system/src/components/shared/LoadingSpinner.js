import React from 'react';
import '../LoadingSpinner.css';

const LoadingSpinner = ({ size = 'medium', text = 'Loading...', overlay = false }) => {
  const spinnerClass = `loading-spinner loading-spinner-${size}`;

  if (overlay) {
    return (
      <div className="loading-overlay">
        <div className="loading-content">
          <div className={spinnerClass}></div>
          {text && <p className="loading-text">{text}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="loading-wrapper">
      <div className={spinnerClass}></div>
      {text && <p className="loading-text">{text}</p>}
    </div>
  );
};

export default LoadingSpinner; 
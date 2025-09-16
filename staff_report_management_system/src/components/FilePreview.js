import React, { useState } from 'react';
import './FilePreview.css';

const FilePreview = ({ file, filename, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const isImage = (filename) => {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    return imageExtensions.some(ext => filename.toLowerCase().endsWith(ext));
  };

  const isPDF = (filename) => {
    return filename.toLowerCase().endsWith('.pdf');
  };

  const getFileUrl = () => {
    if (file) {
      return URL.createObjectURL(file);
    }
    return `http://localhost:5000/reports/download/${filename}`;
  };

  const handleLoad = () => {
    setLoading(false);
  };

  const handleError = () => {
    setLoading(false);
    setError(true);
  };

  const renderPreview = () => {
    if (isImage(filename)) {
      return (
        <img
          src={getFileUrl()}
          alt={filename}
          onLoad={handleLoad}
          onError={handleError}
          className="file-preview-image"
        />
      );
    } else if (isPDF(filename)) {
      return (
        <iframe
          src={`${getFileUrl()}#toolbar=0`}
          onLoad={handleLoad}
          onError={handleError}
          className="file-preview-pdf"
          title={filename}
        />
      );
    } else {
      // Unsupported types: don't wait for load; show immediately
      if (loading) setLoading(false);
      return (
        <div className="file-preview-unsupported">
          <p>Preview not available for this file type</p>
          <p>File: {filename}</p>
          <a href={getFileUrl()} download={filename} className="download-link">
            Download File
          </a>
        </div>
      );
    }
  };

  return (
    <div className="file-preview-overlay" onClick={onClose}>
      <div className="file-preview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="file-preview-header">
          <h3>{filename}</h3>
          <button onClick={onClose} className="close-btn">×</button>
        </div>
        <div className="file-preview-content">
          {loading && <div className="loading">Loading preview...</div>}
          {error && (
            <div className="error">
              <p>Failed to load preview</p>
              <a href={getFileUrl()} download={filename} className="download-link">
                Download File
              </a>
            </div>
          )}
          {renderPreview()}
        </div>
      </div>
    </div>
  );
};

export default FilePreview;

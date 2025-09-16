import React from 'react';

const FileUploadSection = ({ label, accept, onChange, files, onPreview }) => {
  const handleInlinePreview = () => {
    if (files && files.length > 0) {
      onPreview(files[0]);
    }
  };

  return (
    <div className="form-group">
      <label>
        {label}
        <button
          type="button"
          className="inline-preview-btn"
          title="Quick preview"
          onClick={handleInlinePreview}
          disabled={!files || files.length === 0}
          aria-label="Quick preview first selected file"
        >
          👁️
        </button>
      </label>
      <div className="file-upload-section">
        <input
          type="file"
          multiple
          onChange={(e) => onChange(e.target.files)}
          accept={accept}
        />
        <small>You can upload multiple files (PDF, DOC, XLS, images, etc.)</small>
        {files.length > 0 && (
          <div className="file-preview">
            <h4>Selected Files:</h4>
            <div className="file-list">
              {files.map((file, index) => (
                <div key={index} className="file-item">
                  <span className="file-name">{file.name}</span>
                  <div className="file-actions">
                    {(file.type.startsWith('image/') || file.type === 'application/pdf') && (
                      <button
                        onClick={() => onPreview(file)}
                        className="preview-btn"
                      >
                        Preview
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileUploadSection; 
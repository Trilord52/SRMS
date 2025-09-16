import React from 'react';

const StaffTemplatesModal = ({ templates, onApplyTemplate, onResetTemplate, onClose }) => {
  return (
    <div className="modal-overlay">
      <div className="modal templates-modal">
        <div className="modal-header">
          <h2>Report Templates</h2>
          <button
            onClick={onClose}
            className="close-btn"
          >
            ×
          </button>
        </div>
        <div className="modal-content">
          <p className="templates-description">
            Choose a template to quickly fill your report form with predefined content.
          </p>
          <div className="templates-grid">
            {templates.map(template => (
              <div key={template.id} className="template-card">
                <div className="template-header">
                  <h3>{template.name}</h3>
                  <p>{template.description}</p>
                </div>
                <div className="template-preview">
                  <div className="preview-item">
                    <strong>Synchronization:</strong> {template.data.synchronization}
                  </div>
                  <div className="preview-item">
                    <strong>Backup:</strong> {template.data.backupCompletion}
                  </div>
                  <div className="preview-item">
                    <strong>Resources:</strong> {template.data.resourceAvailability}
                  </div>
                  {template.data.incidentReports && (
                    <div className="preview-item">
                      <strong>Incidents:</strong> {template.data.incidentReports.substring(0, 50)}...
                    </div>
                  )}
                </div>
                <div className="template-actions">
                  <button
                    onClick={() => onApplyTemplate(template)}
                    className="apply-template-btn"
                  >
                    Apply Template
                  </button>
                  <button
                    onClick={() => onResetTemplate(template)}
                    className="reset-template-btn"
                  >
                    Reset Form
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffTemplatesModal; 
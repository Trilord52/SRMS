import React from 'react';
import TemplateManager from '../../manager/TemplateManager';

const Templates = ({ onExportCsv, onExportJson, onClose }) => {
  return (
    <>
      <div className="content-header">
        <h1>Template Management</h1>
        <p>Create and manage form templates for staff reports</p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '12px' }}>
        <button className="bulk-export-btn" onClick={onExportCsv}>Export Templates (CSV)</button>
        <button className="bulk-export-btn" onClick={onExportJson}>Export Templates (JSON)</button>
      </div>
      <TemplateManager onClose={onClose} />
    </>
  );
};

export default Templates; 
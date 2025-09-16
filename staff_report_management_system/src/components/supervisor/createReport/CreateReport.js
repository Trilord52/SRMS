import React from 'react';
import DynamicForm from '../../shared/DynamicForm';

const CreateReport = ({ templates, templateSearch, setTemplateSearch, selectedTemplate, onSelectTemplate, onSubmit, formData, onChange, errors, submitting }) => {
  return (
    <>
      <div className="content-header">
        <h1>Create New Report</h1>
        <p>Submit a new database report using a template</p>
      </div>
      {!selectedTemplate ? (
        <div className="template-selection">
          <h2>Select a Template</h2>
          <p>Choose a template to create your report</p>
          <div className="templates-grid-controls">
            <input type="text" placeholder="Search templates..." value={templateSearch} onChange={(e) => setTemplateSearch(e.target.value)} className="templates-search" />
          </div>
          <div className="templates-grid">
            {templates
              .filter(t => (t.name || '').toLowerCase().includes((templateSearch || '').toLowerCase()))
              .map(template => (
                <div key={template._id} className="template-card" onClick={() => onSelectTemplate(template._id)}>
                  <h3>{template.name}</h3>
                  <p>{template.description}</p>
                  <span className="template-category">{template.category}</span>
                </div>
              ))}
          </div>
        </div>
      ) : (
        <div className="form-container">
          <div className="form-title">
            <h2>Create New Report - {selectedTemplate.name}</h2>
            <p>{selectedTemplate.description}</p>
            <button onClick={() => onSelectTemplate(null)} className="change-template-btn">Change Template</button>
          </div>
          <form onSubmit={onSubmit} className="report-form">
            <DynamicForm template={selectedTemplate} formData={formData} onChange={onChange} errors={errors} />
            <div className="form-actions">
              <button type="submit" className="submit-btn" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit Report'}</button>
              <button type="button" onClick={() => onSelectTemplate(null)} className="cancel-btn">Cancel</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};

export default CreateReport; 
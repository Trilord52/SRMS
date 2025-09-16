import React, { useState, useEffect } from 'react';
import './TemplateManager.css';

const TemplateManager = ({ onClose }) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'database-report',
    fields: []
  });
  const [newField, setNewField] = useState({
    name: '',
    type: 'text',
    label: '',
    placeholder: '',
    defaultValue: '',
    required: false,
    order: 0,
    readOnly: false
  });
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/templates', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTemplates(data);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem('token');
      const url = editingTemplate 
        ? `http://localhost:5000/api/templates/${editingTemplate._id}`
        : 'http://localhost:5000/api/templates';
      
      const method = editingTemplate ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        window.showToast(
          editingTemplate ? 'Database template updated successfully!' : 'Database template created successfully!',
          'success'
        );
        fetchTemplates();
        resetForm();
      } else {
        const errorData = await response.json();
        window.showToast(errorData.message || 'Failed to save template', 'error');
      }
    } catch (error) {
      console.error('Error saving template:', error);
      window.showToast('Network error. Please try again.', 'error');
    }
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description,
      category: template.category,
      fields: template.fields
    });
    setShowForm(true);
  };

  const handleDelete = async (templateId) => {
    if (!window.confirm('Are you sure you want to delete this database template?')) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/templates/${templateId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        window.showToast('Database template deleted successfully!', 'success');
        fetchTemplates();
      } else {
        const errorData = await response.json();
        window.showToast(errorData.message || 'Failed to delete template', 'error');
      }
    } catch (error) {
      console.error('Error deleting template:', error);
      window.showToast('Network error. Please try again.', 'error');
    }
  };

  const addField = () => {
    if (!newField.name) {
      window.showToast('Please provide a field name', 'warning');
      return;
    }

    if (newField.readOnly) {
      if (!newField.label) {
        window.showToast('Read-only fields must include a label (info to display)', 'warning');
        return;
      }
    } else {
      if (!newField.type) {
        window.showToast('Editable fields must include a type', 'warning');
        return;
      }
    }
    
    const field = {
      ...newField,
      order: formData.fields.length
    };
    
    setFormData({
      ...formData,
      fields: [...formData.fields, field]
    });
    
    setNewField({
      name: '',
      type: 'text',
      label: '',
      placeholder: '',
      defaultValue: '',
      required: false,
      order: 0,
      readOnly: false
    });
  };

  const removeField = (index) => {
    const updatedFields = formData.fields.filter((_, i) => i !== index);
    setFormData({ ...formData, fields: updatedFields });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: 'database-report',
      fields: []
    });
    setEditingTemplate(null);
    setShowForm(false);
  };

  const getCategoryLabel = (category) => {
    const labels = {
      'database-report': 'Database Report',
      'health-check': 'Health Check',
      'incident-report': 'Incident Report',
      'maintenance-report': 'Maintenance Report',
      'custom': 'Custom'
    };
    return labels[category] || category;
  };

  const filteredTemplates = templates.filter(t => {
    const q = searchQuery.toLowerCase();
    return t.name.toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div className="template-manager">
        <div className="loading">Loading database templates...</div>
      </div>
    );
  }

  return (
    <div className="template-manager">
      <div className="template-manager-header">
        <h2>Database Template Management</h2>
        <p>Create and manage database report templates for your staff</p>
        <div className="header-actions">
          <button
            onClick={() => setShowForm(true)}
            className="btn btn-primary"
          >
            Create New Database Template
          </button>
          <button onClick={onClose} className="btn btn-secondary">
            Close
          </button>
        </div>
      </div>

      {showForm && (
        <div className="template-form-modal">
          <div className="template-form">
            <div className="form-header">
              <h3>{editingTemplate ? 'Edit Database Template' : 'Create New Database Template'}</h3>
              <button onClick={resetForm} className="close-btn">×</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Template Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Weekly Database Health Check"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    <option value="database-report">Database Report</option>
                    <option value="health-check">Health Check</option>
                    <option value="incident-report">Incident Report</option>
                    <option value="maintenance-report">Maintenance Report</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>
              
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows="3"
                  placeholder="Describe what this database template is used for..."
                />
              </div>

              <div className="fields-section">
                <h4>Database Template Fields</h4>
                
                <div className="add-field-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label>Field Name</label>
                      <input
                        type="text"
                        value={newField.name}
                        onChange={(e) => setNewField({ ...newField, name: e.target.value })}
                        placeholder="e.g., databaseName"
                      />
                    </div>
                    
                    <div className="form-group">
                      <label>Field Type</label>
                      <select
                        value={newField.type}
                        onChange={(e) => setNewField({ ...newField, type: e.target.value })}
                        disabled={newField.readOnly}
                        className={newField.readOnly ? 'disabled-select' : ''}
                      >
                        <option value="text">Text</option>
                        <option value="textarea">Textarea</option>
                        <option value="number">Number</option>
                        <option value="date">Date</option>
                        <option value="select">Select</option>
                        <option value="yesno">Yes/No</option>
                        <option value="checkbox">Checkbox</option>
                        <option value="file">File Upload</option>
                      </select>
                    </div>
                    
                    <div className="form-group">
                      <label className={newField.readOnly ? '' : 'muted-label'}>
                        Field Label {newField.readOnly ? '' : '(auto greyed for editable fields)'}
                      </label>
                      <input
                        type="text"
                        value={newField.label}
                        onChange={(e) => setNewField({ ...newField, label: e.target.value })}
                        placeholder={newField.readOnly ? 'e.g., Important note shown to staff' : 'Optional for editable fields'}
                        disabled={!newField.readOnly}
                        className={!newField.readOnly ? 'disabled-select' : ''}
                      />
                    </div>
                    
                    <div className="form-group">
                      <label>
                        <input
                          type="checkbox"
                          checked={newField.required}
                          onChange={(e) => setNewField({ ...newField, required: e.target.checked })}
                          disabled={newField.readOnly}
                        />
                        Required
                      </label>
                    </div>
                    
                    <div className="form-group">
                      <label>
                        <input
                          type="checkbox"
                          checked={newField.readOnly}
                          onChange={(e) => setNewField({ ...newField, readOnly: e.target.checked })}
                        />
                        Read-only (display only)
                      </label>
                    </div>
                    
                    <button type="button" onClick={addField} className="btn btn-small">
                      Add Field
                    </button>
                  </div>
                </div>

                <div className="fields-list">
                  {formData.fields.map((field, index) => (
                    <div key={index} className="field-item">
                      <div className="field-info">
                        <strong>{field.readOnly ? (field.label || field.name) : (field.label || field.name)}</strong> {field.readOnly ? '(info)' : `(${field.type})`}
                        {field.required && !field.readOnly && <span className="required">*</span>}
                        {field.readOnly && <span className="readonly-badge">Read-only</span>}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeField(index)}
                        className="btn btn-small btn-danger"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                  {editingTemplate ? 'Update Database Template' : 'Create Database Template'}
                </button>
                <button type="button" onClick={resetForm} className="btn btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="templates-list">
        <h3>Existing Database Templates</h3>
        <div className="templates-toolbar">
          <input
            type="text"
            className="templates-search"
            placeholder="Search by name, description, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {filteredTemplates.length === 0 ? (
          <div className="no-templates">
            <p>No database templates found. Create your first template!</p>
          </div>
        ) : (
          <div className="templates-grid">
            {filteredTemplates.map(template => (
              <div key={template._id} className="template-card">
                <div className="template-header">
                  <h4>{template.name}</h4>
                  <span className="template-category">
                    {getCategoryLabel(template.category)}
                  </span>
                </div>
                <p className="template-description">{template.description}</p>
                <div className="template-stats">
                  <span>{template.fields.length} fields</span>
                  <span>Version {template.version}</span>
                </div>
                <div className="template-actions">
                  <button
                    onClick={() => handleEdit(template)}
                    className="btn btn-small btn-primary"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(template._id)}
                    className="btn btn-small btn-danger"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TemplateManager;

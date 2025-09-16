import React, { useState, useEffect } from 'react';
import './DynamicForm.css';

const DynamicForm = ({ template, formData, onChange, errors = {} }) => {
  const [localFormData, setLocalFormData] = useState({});

  useEffect(() => {
    if (template) {
      const initialData = {};
      template.fields.forEach(field => {
        initialData[field.name] = formData[field.name] || field.defaultValue || '';
      });
      setLocalFormData(initialData);
    }
  }, [template, formData]);

  const handleFieldChange = (fieldName, value) => {
    const newData = { ...localFormData, [fieldName]: value };
    setLocalFormData(newData);
    onChange(newData);
  };

  const toTitle = (str) => {
    return String(str || '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1));
  };

  const renderField = (field) => {
    const value = localFormData[field.name] || '';
    const error = errors[field.name];
    const titleText = toTitle(field.name);
    const descriptionText = field.label;

    if (field.readOnly) {
      return (
        <div key={field.name} className="form-group full">
          <div className="field-title">{titleText}</div>
          {descriptionText && <div className="readonly-info">{descriptionText}</div>}
        </div>
      );
    }

    switch (field.type) {
      case 'text':
        return (
          <div key={field.name} className="form-group">
            <label htmlFor={field.name}>
              {titleText}
              {field.required && <span className="required">*</span>}
            </label>
            <input
              type="text"
              id={field.name}
              name={field.name}
              value={value}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              className={error ? 'error' : ''}
              readOnly={field.readOnly}
            />
            {descriptionText && <div className="field-description">{descriptionText}</div>}
            {error && <span className="error-message">{error}</span>}
          </div>
        );

      case 'number':
        return (
          <div key={field.name} className="form-group">
            <label htmlFor={field.name}>
              {titleText}
              {field.required && <span className="required">*</span>}
            </label>
            <input
              type="number"
              id={field.name}
              name={field.name}
              value={value}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              min={field.validators?.min}
              max={field.validators?.max}
              className={error ? 'error' : ''}
              readOnly={field.readOnly}
            />
            {descriptionText && <div className="field-description">{descriptionText}</div>}
            {error && <span className="error-message">{error}</span>}
          </div>
        );

      case 'date':
        return (
          <div key={field.name} className="form-group">
            <label htmlFor={field.name}>
              {titleText}
              {field.required && <span className="required">*</span>}
            </label>
            <input
              type="date"
              id={field.name}
              name={field.name}
              value={value}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              className={error ? 'error' : ''}
              readOnly={field.readOnly}
              disabled={field.readOnly}
            />
            {descriptionText && <div className="field-description">{descriptionText}</div>}
            {error && <span className="error-message">{error}</span>}
          </div>
        );

      case 'textarea':
        return (
          <div key={field.name} className="form-group full">
            <label htmlFor={field.name}>
              {titleText}
              {field.required && <span className="required">*</span>}
            </label>
            <textarea
              id={field.name}
              name={field.name}
              value={value}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              rows={4}
              className={error ? 'error' : ''}
              readOnly={field.readOnly}
            />
            {descriptionText && <div className="field-description">{descriptionText}</div>}
            {error && <span className="error-message">{error}</span>}
          </div>
        );

      case 'select':
        return (
          <div key={field.name} className="form-group">
            <label htmlFor={field.name}>
              {titleText}
              {field.required && <span className="required">*</span>}
            </label>
            <select
              id={field.name}
              name={field.name}
              value={value}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              className={error ? 'error' : ''}
              disabled={field.readOnly}
            >
              <option value="">Select {titleText}</option>
              {field.options?.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {descriptionText && <div className="field-description">{descriptionText}</div>}
            {error && <span className="error-message">{error}</span>}
          </div>
        );

      case 'yesno':
        return (
          <div key={field.name} className="form-group">
            <label>
              {titleText}
              {field.required && <span className="required">*</span>}
            </label>
            <div className="yesno-group">
              <label className="radio-label">
                <input
                  type="radio"
                  name={field.name}
                  value="Yes"
                  checked={value === 'Yes'}
                  onChange={(e) => handleFieldChange(field.name, e.target.value)}
                  disabled={field.readOnly}
                />
                Yes
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name={field.name}
                  value="No"
                  checked={value === 'No'}
                  onChange={(e) => handleFieldChange(field.name, e.target.value)}
                  disabled={field.readOnly}
                />
                No
              </label>
            </div>
            {descriptionText && <div className="field-description">{descriptionText}</div>}
            {error && <span className="error-message">{error}</span>}
          </div>
        );

      case 'checkbox':
        return (
          <div key={field.name} className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name={field.name}
                checked={value === true || value === 'true'}
                onChange={(e) => handleFieldChange(field.name, e.target.checked)}
                disabled={field.readOnly}
              />
              {titleText}
              {field.required && <span className="required">*</span>}
            </label>
            {descriptionText && <div className="field-description">{descriptionText}</div>}
            {error && <span className="error-message">{error}</span>}
          </div>
        );

      case 'file':
        return (
          <div key={field.name} className="form-group full">
            <label htmlFor={field.name}>
              {titleText}
              {field.required && <span className="required">*</span>}
            </label>
            <input
              type="file"
              id={field.name}
              name={field.name}
              onChange={(e) => handleFieldChange(field.name, e.target.files)}
              multiple
              className={error ? 'error' : ''}
              disabled={field.readOnly}
            />
            {descriptionText && <div className="field-description">{descriptionText}</div>}
            {error && <span className="error-message">{error}</span>}
          </div>
        );

      default:
        return null;
    }
  };

  if (!template) {
    return <div className="no-template">No template selected</div>;
  }

  return (
    <div className="dynamic-form">
      <div className="form-header">
        <h3>{template.name}</h3>
        <p>{template.description}</p>
      </div>
      
      <div className="form-fields">
        {template.fields
          .sort((a, b) => (a.order || 0) - (b.order || 0))
          .map(field => renderField(field))}
      </div>
    </div>
  );
};

export default DynamicForm;

import React from 'react';

const TextAreasSection = ({ formData, formErrors, touched, onChange }) => {
  return (
    <>
      <div className="form-group">
        <label>Incident Reports</label>
        <textarea
          name="incidentReports"
          value={formData.incidentReports}
          onChange={onChange}
          rows="4"
          placeholder="Describe any incidents or issues encountered..."
          className={formErrors.incidentReports && touched.incidentReports ? 'error' : ''}
        />
        {formErrors.incidentReports && touched.incidentReports && (
          <span className="error-message">{formErrors.incidentReports}</span>
        )}
      </div>
      <div className="form-group">
        <label>Additional Remarks</label>
        <textarea
          name="additionalRemarks"
          value={formData.additionalRemarks}
          onChange={onChange}
          rows="4"
          placeholder="Any additional comments or observations..."
          className={formErrors.additionalRemarks && touched.additionalRemarks ? 'error' : ''}
        />
        {formErrors.additionalRemarks && touched.additionalRemarks && (
          <span className="error-message">{formErrors.additionalRemarks}</span>
        )}
      </div>
    </>
  );
};

export default TextAreasSection; 
import React from 'react';

const YesNoSelectorsSection = ({ formData, onChange }) => {
  return (
    <div className="form-row">
      <div className="form-group">
        <label>Synchronization</label>
        <select 
          name="synchronization" 
          value={formData.synchronization}
          onChange={onChange}
        >
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      </div>
      <div className="form-group">
        <label>Backup Completion</label>
        <select 
          name="backupCompletion" 
          value={formData.backupCompletion}
          onChange={onChange}
        >
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      </div>
      <div className="form-group">
        <label>Resource Availability</label>
        <select 
          name="resourceAvailability" 
          value={formData.resourceAvailability}
          onChange={onChange}
        >
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      </div>
    </div>
  );
};

export default YesNoSelectorsSection; 
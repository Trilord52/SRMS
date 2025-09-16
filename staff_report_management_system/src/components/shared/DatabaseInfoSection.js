import React from 'react';

const DatabaseInfoSection = ({
  databases,
  formData,
  formErrors,
  touched,
  onChange
}) => {
  return (
    <>
      <div className="form-row">
        <div className="form-group">
          <label>Database</label>
          <select 
            name="database" 
            value={formData.database}
            onChange={onChange}
            required
            className={formErrors.database && touched.database ? 'error' : ''}
          >
            <option value="">Select Database</option>
            {databases.map(db => (
              <option key={db._id} value={db.database}>
                {db.database}
              </option>
            ))}
          </select>
          {formErrors.database && touched.database && (
            <span className="error-message">{formErrors.database}</span>
          )}
          <small>Selecting a database will auto-populate technical fields</small>
        </div>
        <div className="form-group">
          <label>IP Address</label>
          <input
            type="text"
            name="ipAddress"
            value={formData.ipAddress}
            onChange={onChange}
            required
            readOnly
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>OS Version</label>
          <input
            type="text"
            name="osVersion"
            value={formData.osVersion}
            onChange={onChange}
            required
            readOnly
          />
        </div>
        <div className="form-group">
          <label>Database Type</label>
          <input
            type="text"
            name="databaseType"
            value={formData.databaseType}
            onChange={onChange}
            required
            readOnly
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>DB Version</label>
          <input
            type="text"
            name="dbVersion"
            value={formData.dbVersion}
            onChange={onChange}
            required
            readOnly
          />
        </div>
      </div>
    </>
  );
};

export default DatabaseInfoSection; 
import React from 'react';

const Databases = ({ databases, selectedDatabases, onSelectDatabase, onSelectAll, onAdd, onEdit, onDelete, onBulkDelete, onBulkExport, bulkDeleting, deleting }) => {
  return (
    <>
      <div className="content-header">
        <h1>Database Management</h1>
        <p>Manage and monitor all databases</p>
      </div>
      <div className="databases-section">
        <div className="section-header">
          <h2>Databases</h2>
          <button onClick={onAdd} className="add-btn">Add Database</button>
        </div>
        {databases.length > 0 && (
          <div className="bulk-operations">
            <div className="bulk-controls">
              <label className="select-all-checkbox">
                <input type="checkbox" checked={selectedDatabases.length === databases.length && databases.length > 0} onChange={onSelectAll} />
                Select All ({selectedDatabases.length}/{databases.length})
              </label>
              {selectedDatabases.length > 0 && (
                <div className="bulk-actions">
                  <button onClick={onBulkDelete} className={`bulk-delete-btn ${bulkDeleting ? 'btn-loading' : ''}`} disabled={bulkDeleting}>
                    {bulkDeleting ? 'Deleting...' : `Delete Selected (${selectedDatabases.length})`}
                  </button>
                  <button onClick={onBulkExport} className="bulk-export-btn">Export Selected ({selectedDatabases.length})</button>
                </div>
              )}
            </div>
          </div>
        )}
        <div className="databases-grid">
          {databases.map(database => (
            <div key={database._id} className="database-card">
              <div className="database-checkbox">
                <input type="checkbox" checked={selectedDatabases.includes(database._id)} onChange={() => onSelectDatabase(database._id)} />
              </div>
              <div className="database-header">
                <h3>{database.database}</h3>
                <button onClick={() => onEdit(database)} className="edit-btn">Edit</button>
                <button onClick={() => onDelete(database._id)} className={`delete-btn ${deleting === database._id ? 'btn-loading' : ''}`} disabled={deleting === database._id}>
                  {deleting === database._id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
              <div className="database-details">
                <p><strong>Type:</strong> {database.databaseType}</p>
                <p><strong>IP Address:</strong> {database.ipAddress}</p>
                <p><strong>OS Version:</strong> {database.osVersion}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default Databases; 
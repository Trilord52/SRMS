import React from 'react';

const StaffManagement = ({ staffList, getStaffSubmissionStatus, getReportsByStaff, onSelectStaff }) => {
  return (
    <>
      <div className="content-header">
        <h1>Staff Management</h1>
        <p>Monitor staff activity and submission status</p>
      </div>
      <div className="staff-section">
        <h2>Staff List & Weekly Status</h2>
        <div className="staff-grid">
          {staffList.map(staff => {
            const status = getStaffSubmissionStatus(staff._id);
            const staffReports = getReportsByStaff(staff._id);
            return (
              <div key={staff._id} className="staff-card">
                <div className="staff-header">
                  <div className="staff-info">
                    <h3>{staff.firstName} {staff.lastName}</h3>
                    <p>{staff.email}</p>
                    <span className="staff-id">ID: {staff.userId}</span>
                  </div>
                  <div className="staff-status">
                    <div className={`status-indicator ${status.thisWeek > 0 ? 'active' : 'inactive'}`}>
                      {status.thisWeek > 0 ? '✓' : '○'}
                    </div>
                  </div>
                </div>
                <div className="staff-stats">
                  <div className="stat-item">
                    <span className="stat-label">Total Reports:</span>
                    <span className="stat-value">{status.total}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">This Week:</span>
                    <span className="stat-value">{status.thisWeek}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Last Submission:</span>
                    <span className="stat-value">{status.lastSubmission ? status.lastSubmission.toLocaleDateString() : 'Never'}</span>
                  </div>
                </div>
                <button className="view-reports-btn" onClick={() => onSelectStaff(staff)}>
                  View Reports ({staffReports.length})
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default StaffManagement; 
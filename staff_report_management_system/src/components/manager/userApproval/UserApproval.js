import React from 'react';

const UserApproval = ({ loading, error, pendingUsers, approvingUser, onApprove, onReject }) => {
  if (loading) return <div className="loading">Loading users...</div>;
  if (error) return <div className="error">Failed to load users: {error}</div>;
  return (
    <>
      <div className="content-header">
        <h1>User Approval Management</h1>
        <p>Review and approve new user registrations</p>
      </div>
      <div className="approval-section">
        <div className="pending-users-section">
          <h2>Pending User Registrations ({pendingUsers.length})</h2>
          {pendingUsers.length === 0 ? (
            <div className="no-pending-users"><p>No pending user registrations</p></div>
          ) : (
            <div className="users-grid">
              {pendingUsers.map(user => (
                <div key={user._id} className="user-card">
                  <div className="user-header">
                    <div className="user-info">
                      <h3>{user.firstName} {user.lastName}</h3>
                      <p className="user-email">{user.email}</p>
                      <p className="user-id">ID: {user.userId}</p>
                      <p className="user-role">Role: <span className="role-badge">{user.role}</span></p>
                    </div>
                    <div className="user-status">
                      <span className="status-badge pending">Pending Approval</span>
                    </div>
                  </div>
                  <div className="user-details">
                    <div className="detail-item"><strong>Registration Date:</strong><span>{new Date(user.createdAt).toLocaleDateString()}</span></div>
                    <div className="detail-item"><strong>Department:</strong><span>{user.department || 'Not specified'}</span></div>
                    <div className="detail-item"><strong>Phone:</strong><span>{user.phone || 'Not provided'}</span></div>
                    {user.notes && (<div className="detail-item"><strong>Notes:</strong><span>{user.notes}</span></div>)}
                  </div>
                  <div className="user-actions">
                    <button onClick={() => onApprove(user._id)} className={`approve-btn ${approvingUser === user._id ? 'loading' : ''}`} disabled={approvingUser === user._id}>
                      {approvingUser === user._id ? 'Approving...' : 'Approve'}
                    </button>
                    <button onClick={() => { const reason = prompt('Please provide a reason for rejection:'); if (reason && reason.trim()) onReject(user._id, reason.trim()); }} className={`reject-btn ${approvingUser === user._id ? 'loading' : ''}`} disabled={approvingUser === user._id}>
                      {approvingUser === user._id ? 'Processing...' : 'Reject'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default UserApproval; 
import React from 'react';

const UserCard = ({ user, approvingUserId, onApprove, onReject }) => {
  return (
    <div className={`user-card ${user.approvalStatus || 'pending'}`}>
      <div className="user-header">
        <h3>{user.firstName} {user.lastName}</h3>
        <span className={`role-badge ${user.role}`}>{user.role}</span>
        {user.approvalStatus && (
          <span className={`status-badge ${user.approvalStatus}`}>
            {user.approvalStatus === 'approved' ? '✓ Approved' : user.approvalStatus === 'pending' ? '⏳ Pending' : '❌ Rejected'}
          </span>
        )}
      </div>
      <div className="user-details">
        <p><strong>User ID:</strong> {user.userId}</p>
        <p><strong>Email:</strong> {user.email}</p>
        <p><strong>Department:</strong> {user.department || 'Not specified'}</p>
        <p><strong>Phone:</strong> {user.phoneNumber || 'Not specified'}</p>
        <p><strong>Registration Date:</strong> {new Date(user.createdAt).toLocaleDateString()}</p>
        {user.approvedBy && (
          <p><strong>Approved By:</strong> {user.approvedBy.firstName} {user.approvedBy.lastName}</p>
        )}
        {user.approvedAt && (
          <p><strong>Approved At:</strong> {new Date(user.approvedAt).toLocaleDateString()}</p>
        )}
        {user.rejectionReason && (
          <p><strong>Rejection Reason:</strong> {user.rejectionReason}</p>
        )}
      </div>
      {user.approvalStatus === 'pending' && (
        <div className="user-actions">
          <button
            onClick={() => onApprove(user._id)}
            className="approve-btn"
            disabled={approvingUserId === user._id}
          >
            {approvingUserId === user._id ? 'Approving...' : 'Approve'}
          </button>
          <button
            onClick={() => {
              const reason = prompt('Please provide a reason for rejection:');
              if (reason !== null) onReject(user._id, reason);
            }}
            className="reject-btn"
            disabled={approvingUserId === user._id}
          >
            {approvingUserId === user._id ? 'Rejecting...' : 'Reject'}
          </button>
        </div>
      )}
    </div>
  );
};

export default UserCard; 
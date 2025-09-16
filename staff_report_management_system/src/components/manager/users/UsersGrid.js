import React from 'react';
import UserCard from './UserCard';

const UsersGrid = ({ users, approvingUserId, onApprove, onReject }) => {
  if (!users || users.length === 0) {
    return <div className="no-users"><p>No users found</p></div>;
  }
  return (
    <div className="users-grid">
      {users.map(user => (
        <UserCard
          key={user._id}
          user={user}
          approvingUserId={approvingUserId}
          onApprove={onApprove}
          onReject={onReject}
        />
      ))}
    </div>
  );
};

export default UsersGrid; 
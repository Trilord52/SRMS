import React from 'react';
import ManagerAnalytics from '../../manager/ManagerAnalytics';

const Overview = ({ staffOptions }) => {
  return (
    <>
      <div className="content-header">
        <h1>Supervisor Dashboard</h1>
        <p>Review and manage staff reports</p>
      </div>
      <ManagerAnalytics period="weekly" staffOptions={staffOptions} />
    </>
  );
};

export default Overview; 
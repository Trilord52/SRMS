import React from 'react';
import ManagerAnalytics from '../../manager/ManagerAnalytics';

const Overview = ({ staffOptions, period = 'weekly', onLoadingChange }) => {
  return (
    <>
      <div className="content-header">
        <h1>Manager Overview</h1>
        <p>Quick insights into system performance</p>
      </div>
      <ManagerAnalytics period={period} staffOptions={staffOptions} onLoadingChange={onLoadingChange} />
    </>
  );
};

export default Overview; 
import React from 'react';

const SupervisorSidebar = ({ activeTab, onChangeTab, sidebarCollapsed, onToggleSidebar, onLogout }) => {
  return (
    <div className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <img src="/logo-removebg-preview.png" alt="Bank of Abyssinia Logo" />
          {!sidebarCollapsed && <h2>Bank of Abyssinia</h2>}
        </div>
      </div>
      <div className="sidebar-nav">
        <a href="#overview" className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); onChangeTab('overview'); }} title="Overview">
          <i>📊</i>
          {!sidebarCollapsed && <span>Overview</span>}
        </a>
        <a href="#reports" className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); onChangeTab('reports'); }} title="Review Reports">
          <i>📋</i>
          {!sidebarCollapsed && <span>Review Reports</span>}
        </a>
        <a href="#create-report" className={`nav-item ${activeTab === 'create-report' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); onChangeTab('create-report'); }} title="Create Report">
          <i>✏️</i>
          {!sidebarCollapsed && <span>Create Report</span>}
        </a>
        <a href="#history" className={`nav-item ${activeTab === 'history' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); onChangeTab('history'); }} title="History">
          <i>📈</i>
          {!sidebarCollapsed && <span>History</span>}
        </a>
        <a href="#password-reset" className={`nav-item ${activeTab === 'password-reset' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); onChangeTab('password-reset'); }} title="Password Reset">
          <i>🔑</i>
          {!sidebarCollapsed && <span>Password Reset</span>}
        </a>
        <a href="#settings" className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); onChangeTab('settings'); }} title="Settings">
          <i>⚙️</i>
          {!sidebarCollapsed && <span>Settings</span>}
        </a>
        <button className="sidebar-toggle" onClick={onToggleSidebar}>
          {sidebarCollapsed ? '>' : '<'}
        </button>
        <a href="#logout" className="nav-item logout-item" onClick={(e) => { e.preventDefault(); onLogout(); }} title="Log Out">
          <i>🚪</i>
          {!sidebarCollapsed && <span>Log Out</span>}
        </a>
      </div>
    </div>
  );
};

export default SupervisorSidebar;
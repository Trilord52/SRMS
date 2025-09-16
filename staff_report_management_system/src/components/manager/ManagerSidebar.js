import React from 'react';

const ManagerSidebar = ({ activeTab, onChangeTab, sidebarCollapsed, onToggleSidebar, onLogout }) => {
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
        <a href="#staff" className={`nav-item ${activeTab === 'staff' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); onChangeTab('staff'); }} title="Staff Management">
          <i>👥</i>
          {!sidebarCollapsed && <span>Staff Management</span>}
        </a>
        <a href="#staff-reports" className={`nav-item ${activeTab === 'staff-reports' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); onChangeTab('staff-reports'); }} title="Staff Reports">
          <i>📋</i>
          {!sidebarCollapsed && <span>Staff Reports</span>}
        </a>
        <a href="#templates" className={`nav-item ${activeTab === "templates" ? "active" : ""}`} onClick={(e) => { e.preventDefault(); onChangeTab("templates"); }} title="Template Management">
          <i>📋</i>
          {!sidebarCollapsed && <span>Templates</span>}
        </a>
        <a href="#user-approval" className={`nav-item ${activeTab === 'user-approval' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); onChangeTab('user-approval'); }} title="User Approval">
          <i>👤</i>
          {!sidebarCollapsed && <span>User Approval</span>}
        </a>
        <a href="#password-reset" className={`nav-item ${activeTab === 'password-reset' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); onChangeTab('password-reset'); }} title="Password Reset">
          <i>🔑</i>
          {!sidebarCollapsed && <span>Password Reset</span>}
        </a>
        <a href="#settings" className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); onChangeTab('settings'); }} title="Settings">
          <i>⚙️</i>
          {!sidebarCollapsed && <span>Settings</span>}
        </a>
        <button className="sidebar-toggle" onClick={onToggleSidebar}>{sidebarCollapsed ? '>' : '<'}</button>
        <a href="#logout" className="nav-item logout-item" onClick={(e) => { e.preventDefault(); onLogout(); }} title="Log Out">
          <i>🚪</i>
          {!sidebarCollapsed && <span>Log Out</span>}
        </a>
      </div>
    </div>
  );
};

export default ManagerSidebar;
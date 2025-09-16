import React from 'react';

const StaffSidebar = ({ activeTab, onChangeTab, sidebarCollapsed, onToggleSidebar, onLogout }) => {
  return (
    <div className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <img src="/logo-removebg-preview.png" alt="Bank of Abyssinia Logo" />
          {!sidebarCollapsed && <h2>Bank of Abyssinia</h2>}
        </div>
      </div>
      <div className="sidebar-nav">
        <a
          href="#reports"
          className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={(e) => {
            e.preventDefault();
            onChangeTab('reports');
          }}
          title="Weekly Reports"
        >
          <i>📊</i>
          {!sidebarCollapsed && <span>Weekly Reports</span>}
        </a>
        <button
          className="sidebar-toggle"
          onClick={onToggleSidebar}
        >
          {sidebarCollapsed ? '>' : '<'}
        </button>
        <a
          href="#history"
          className={`nav-item ${activeTab === 'history' ? 'active' : ''}`}
          onClick={(e) => {
            e.preventDefault();
            onChangeTab('history');
          }}
          title="History"
        >
          <i>📈</i>
          {!sidebarCollapsed && <span>History</span>}
        </a>
        <a
          href="#settings"
          className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={(e) => {
            e.preventDefault();
            onChangeTab('settings');
          }}
          title="Settings"
        >
          <i>⚙️</i>
          {!sidebarCollapsed && <span>Settings</span>}
        </a>
        <a
          href="#logout"
          className="nav-item logout-item"
          onClick={(e) => {
            e.preventDefault();
            onLogout();
          }}
          title="Log Out"
        >
          <i>🚪</i>
          {!sidebarCollapsed && <span>Log Out</span>}
        </a>
      </div>
    </div>
  );
};

export default StaffSidebar; 
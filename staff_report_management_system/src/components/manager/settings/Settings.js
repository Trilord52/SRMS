import React from 'react';

const Settings = ({ user, darkMode, settings, onToggleTheme, onChangeSetting }) => {
  return (
    <>
      <div className="content-header">
        <h1>Settings</h1>
        <p>Manage your account settings and preferences</p>
      </div>
      <div className="settings-container">
        <div className="settings-section">
          <h3>Appearance</h3>
          <div className="setting-item">
            <div className="setting-info">
              <label>Dark Mode</label>
              <p>Switch between light and dark themes</p>
            </div>
            <div className="setting-control">
              <label className="toggle-switch">
                <input type="checkbox" checked={darkMode} onChange={(e) => onToggleTheme(e.target.checked)} />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>
        <div className="settings-section">
          <h3>Notifications</h3>
          <div className="setting-item">
            <div className="setting-info">
              <label>Email Notifications</label>
              <p>Receive email alerts for important updates</p>
            </div>
            <div className="setting-control">
              <label className="toggle-switch">
                <input type="checkbox" checked={settings.emailNotifications} onChange={(e) => onChangeSetting('emailNotifications', e.target.checked)} />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
          <div className="setting-item">
            <div className="setting-info">
              <label>Weekly Reminders</label>
              <p>Get reminded about weekly report submissions</p>
            </div>
            <div className="setting-control">
              <label className="toggle-switch">
                <input type="checkbox" checked={settings.weeklyReminders} onChange={(e) => onChangeSetting('weeklyReminders', e.target.checked)} />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>
        <div className="settings-section">
          <h3>Preferences</h3>
          <div className="setting-item">
            <div className="setting-info">
              <label>Show Analytics</label>
              <p>Display analytics and statistics on dashboard</p>
            </div>
            <div className="setting-control">
              <label className="toggle-switch">
                <input type="checkbox" checked={settings.showAnalytics} onChange={(e) => onChangeSetting('showAnalytics', e.target.checked)} />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
          <div className="setting-item">
            <div className="setting-info">
              <label>Export Reports</label>
              <p>Allow exporting reports to various formats</p>
            </div>
            <div className="setting-control">
              <label className="toggle-switch">
                <input type="checkbox" checked={settings.exportReports} onChange={(e) => onChangeSetting('exportReports', e.target.checked)} />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
          <div className="setting-item">
            <div className="setting-info">
              <label>Timezone</label>
              <p>Set your local timezone</p>
            </div>
            <div className="setting-control">
              <select value={settings.timezone} onChange={(e) => onChangeSetting('timezone', e.target.value)} className="settings-select">
                <option value="UTC+3">UTC+3 (East Africa Time)</option>
                <option value="UTC+0">UTC+0 (GMT)</option>
                <option value="UTC-5">UTC-5 (Eastern Time)</option>
                <option value="UTC+1">UTC+1 (Central European Time)</option>
              </select>
            </div>
          </div>
        </div>
        <div className="settings-section">
          <h3>Account Information</h3>
          <div className="account-info">
            <div className="info-item"><label>Name:</label><span>{user?.firstName} {user?.lastName}</span></div>
            <div className="info-item"><label>User ID:</label><span>{user?.userId}</span></div>
            <div className="info-item"><label>Email:</label><span>{user?.email}</span></div>
            <div className="info-item"><label>Role:</label><span className="role-badge">{user?.role}</span></div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Settings; 
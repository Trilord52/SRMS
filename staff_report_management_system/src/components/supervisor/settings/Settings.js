import React from 'react';

const Settings = ({ user, darkMode, setDarkMode, settings, setSettings }) => {
  return (
    <>
      <div className="content-header">
        <h1>Settings</h1>
        <p>Manage your account preferences and notifications</p>
      </div>
      <div className="settings-container">
        <div className="settings-section">
          <h3>Notifications</h3>
          <div className="setting-item">
            <div className="setting-info">
              <label>Email Notifications</label>
              <p>Receive email notifications for new reports</p>
            </div>
            <div className="setting-control">
              <label className="toggle-switch">
                <input type="checkbox" checked={settings.emailNotifications} onChange={(e) => setSettings({ ...settings, emailNotifications: e.target.checked })} />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
          <div className="setting-item">
            <div className="setting-info">
              <label>Weekly Reminders</label>
              <p>Get reminded about pending reviews</p>
            </div>
            <div className="setting-control">
              <label className="toggle-switch">
                <input type="checkbox" checked={settings.weeklyReminders} onChange={(e) => setSettings({ ...settings, weeklyReminders: e.target.checked })} />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>
        <div className="settings-section">
          <h3>Appearance</h3>
          <div className="setting-item">
            <div className="setting-info">
              <label>Dark Mode</label>
              <p>Switch between light and dark themes</p>
            </div>
            <div className="setting-control">
              <label className="toggle-switch">
                <input type="checkbox" checked={darkMode} onChange={(e) => setDarkMode(e.target.checked)} />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>
        <div className="settings-section">
          <h3>Account Information</h3>
          <div className="account-info">
            <div className="info-item"><label>Name:</label><span>{user?.firstName} {user?.lastName}</span></div>
            <div className="info-item"><label>Email:</label><span>{user?.email}</span></div>
            <div className="info-item"><label>Role:</label><span className="role-badge">{user?.role}</span></div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Settings; 
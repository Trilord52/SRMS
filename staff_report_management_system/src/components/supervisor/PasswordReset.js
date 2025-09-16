import React, { useState } from 'react';

const PasswordReset = () => {
  const [targetEmail, setTargetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleReset = async (e) => {
    e.preventDefault();
    if (!targetEmail || !newPassword) {
      return window.showToast('Provide email and new password', 'warning');
    }
    try {
      setSubmitting(true);
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/auth/reset-password', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ targetEmail, newPassword })
      });
      const data = await res.json();
      if (!res.ok) {
        return window.showToast(data.message || 'Failed to reset password', 'error');
      }
      window.showToast('Password reset successfully', 'success');
      setTargetEmail('');
      setNewPassword('');
    } catch (e) {
      console.error('Reset password error', e);
      window.showToast('Network error. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="password-reset">
      <div className="content-header">
        <h1>Password Reset</h1>
        <p>Reset passwords for staff</p>
      </div>
      <form onSubmit={handleReset} className="password-reset-form" style={{ maxWidth: 480 }}>
        <div className="form-group">
          <label>Staff Email</label>
          <input type="email" value={targetEmail} onChange={(e) => setTargetEmail(e.target.value)} placeholder="staff@bankofabyssinia.com" required />
        </div>
        <div className="form-group">
          <label>New Password</label>
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password" required />
        </div>
        <div className="form-actions">
          <button type="submit" className={`submit-btn ${submitting ? 'btn-loading' : ''}`} disabled={submitting}>
            {submitting ? 'Resetting...' : 'Reset Password'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PasswordReset; 
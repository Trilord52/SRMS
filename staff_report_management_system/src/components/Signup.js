import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Signup.css';

const Signup = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    userId: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'staff',
    department: '',
    phoneNumber: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Load saved dark mode preference
    const savedDarkMode = localStorage.getItem('darkMode') === 'true';
    setDarkMode(savedDarkMode);
    if (savedDarkMode) {
      document.body.classList.add('dark-mode');
    }
  }, []);

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem('darkMode', newDarkMode.toString());
    if (newDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          userId: formData.userId,
          email: formData.email,
          password: formData.password,
          role: formData.role,
          department: formData.department,
          phoneNumber: formData.phoneNumber
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSuccess(data.message || 'Registration submitted successfully! Please wait for approval from the administrator.');
        // Clear form after successful registration
        setFormData({
          firstName: '',
          lastName: '',
          userId: '',
          email: '',
          password: '',
          confirmPassword: '',
          role: 'staff',
          department: '',
          phoneNumber: ''
        });
      } else {
        const data = await response.json();
        setError(data.message || 'Registration failed');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-container">
      {/* Dark Mode Toggle */}
      <div className="dark-mode-toggle">
        <button onClick={toggleDarkMode} className="toggle-btn">
          {darkMode ? '☀️' : '🌙'}
        </button>
      </div>

      <div className="signup-card">
        <div className="signup-left">
                      <div className="headline">
              <h2>Create Account</h2>
              <p>Please fill in the details to create your account. Manager registrations are auto-approved, while Staff and Supervisor registrations require administrator review.</p>
            </div>
          <form onSubmit={handleSubmit} className="signup-form">
            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="firstName">First Name</label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                  placeholder="Enter first name"
                />
              </div>
              <div className="form-group">
                <label htmlFor="lastName">Last Name</label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  placeholder="Enter last name"
                />
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="userId">User ID</label>
              <input
                type="text"
                id="userId"
                name="userId"
                value={formData.userId}
                onChange={handleChange}
                required
                placeholder="Enter user ID"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="Enter your Bank of Abyssinia email"
              />
              <small>Must be a valid @bankofabyssinia.com email address</small>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="department">Department</label>
                <input
                  type="text"
                  id="department"
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  placeholder="Enter your department"
                />
              </div>
              <div className="form-group">
                <label htmlFor="phoneNumber">Phone Number</label>
                <input
                  type="tel"
                  id="phoneNumber"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  placeholder="Enter phone number"
                />
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="role">Role</label>
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleChange}
                required
              >
                <option value="staff">Staff</option>
                <option value="supervisor">Supervisor</option>
                <option value="manager">Manager</option>
              </select>
                          <small>
              Manager registrations are auto-approved. Staff and Supervisor registrations require administrator approval.
            </small>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  placeholder="Enter password"
                />
              </div>
              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  placeholder="Confirm password"
                />
              </div>
            </div>
            
            <button
              type="submit"
              className="signup-button"
              disabled={loading}
            >
              {loading ? 'Creating Account...' : 'Sign Up'}
            </button>
          </form>
          <div className="signup-footer">
            <p>
              Already have an account?{' '}
              <span
                className="link"
                onClick={() => navigate('/login')}
              >
                Sign in
              </span>
            </p>
          </div>
        </div>
        <div className="signup-right">
          <div className="branding-section">
            <div className="logo">
              <img src="/logo-removebg-preview.png" alt="Bank of Abyssinia Logo" />
            </div>
            <div className="branding-text">
              <h1>Bank of Abyssinia</h1>
              <div className="amharic-text">
                <img src="/amharic text.PNG" alt="ባንክ ኦፍ አቢሲኒያ" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
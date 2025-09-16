import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
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

    try {
      const response = await fetch('http://localhost:5000/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        if (rememberMe) {
          localStorage.setItem('rememberMe', 'true');
        } else {
          localStorage.removeItem('rememberMe');
        }

        // Navigate based on role
        if (data.user.role === 'staff') {
          navigate('/staff-dashboard');
        } else if (data.user.role === 'supervisor') {
          navigate('/supervisor-dashboard');
        } else if (data.user.role === 'manager') {
          navigate('/manager-dashboard');
        }
      } else {
        const data = await response.json();
        // Handle approval status messages
        if (data.approvalStatus === 'pending') {
          setError('Your account is pending approval. Please contact the administrator.');
        } else if (data.approvalStatus === 'rejected') {
          setError(`Your registration has been rejected. Reason: ${data.rejectionReason || 'No reason provided'}. Please contact the administrator or try registering again.`);
        } else {
          setError(data.message || 'Login failed');
        }
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* Dark Mode Toggle */}
      <div className="dark-mode-toggle">
        <button onClick={toggleDarkMode} className="toggle-btn">
          {darkMode ? '☀️' : '🌙'}
        </button>
      </div>

      <div className="login-card">
        <div className="login-left">
          <div className="headline">
            <h2>Welcome Back</h2>
            <p>Sign in to your account to continue</p>
          </div>
          <form onSubmit={handleSubmit} className="login-form">
            {error && <div className="error-message">{error}</div>}
            
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="Enter your email"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="Enter your password"
              />
            </div>
            
            <div className="form-options">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span className="checkmark"></span>
                Remember me
              </label>
            </div>
            
            <button
              type="submit"
              className="login-button"
              disabled={loading}
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
          <div className="login-footer">
            <p>
              Don't have an account?{' '}
              <span
                className="link"
                onClick={() => navigate('/signup')}
              >
                Sign up
              </span>
            </p>
          </div>
        </div>
        <div className="login-right">
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

export default Login;
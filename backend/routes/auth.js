const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authenticate = require('../middleware/auth');
const router = express.Router();

// Register new user (managers auto-approved, others need approval)
router.post('/register', async (req, res) => {
  try {
    console.log('Registration request received:', { email: req.body.email, role: req.body.role });

    const { firstName, lastName, userId, email, password, role, department, phoneNumber } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !userId || !email || !password) {
      return res.status(400).json({ 
        message: 'All fields are required: firstName, lastName, userId, email, password'
      });
    }

    // Validate email format
    const emailRegex = /^[\w.-]+@bankofabyssinia\.com$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        message: 'Email must be a valid Bank of Abyssinia email address' 
      });
    }
   
    // Check if user email already exists
    const existingEmail = await User.findOne({  email });
    if (existingEmail) {
      return res.status(400).json({ message: 'User already exists' });
    }
    // Check if userId already exists
    const existingUserId = await User.findOne({ userId });
    if (existingUserId) {
      return res.status(400).json({ message: 'User ID already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Managers are auto-approved, others need approval
    const isApproved = role === 'manager';
    const approvalStatus = role === 'manager' ? 'approved' : 'pending';

    // Create new user
    const user = new User({
      firstName,
      lastName,
      userId,
      email,
      password: hashedPassword,
      role: role || 'staff',
      department,
      phoneNumber,
      isApproved,
      approvalStatus
    });

    await user.save();
    console.log('User registration completed:', user._id);

    res.status(201).json({
      message: role === 'manager' 
        ? 'Registration successful! You can now log in.' 
        : 'Registration submitted successfully. Please wait for approval from the administrator.',
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        userId: user.userId,
        email: user.email,
        role: user.role,
        approvalStatus: user.approvalStatus
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      message: 'Server error during registration',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Registration failed'
    });
  }
});

// Login user (check approval status)
router.post('/login', async (req, res) => {
  try {
    console.log('Login request received:', { email: req.body.email });
    
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ 
        message: 'Email and password are required' 
      });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check approval status
    if (!user.isApproved) {
      if (user.approvalStatus === 'pending') {
        return res.status(403).json({ 
          message: 'Your account is pending approval. Please contact the administrator.',
          approvalStatus: 'pending'
        });
      } else if (user.approvalStatus === 'rejected') {
        return res.status(403).json({ 
          message: `Your registration has been rejected. Reason: ${user.rejectionReason || 'No reason provided'}. Please contact the administrator or try registering again.`,
          approvalStatus: 'rejected',
          rejectionReason: user.rejectionReason
        });
      }
    }

    console.log('User logged in successfully:', user._id);

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        userId: user.userId,
        email: user.email,
        role: user.role,
        department: user.department
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      message: 'Server error during login',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Login failed'
    });
  }
});

// Get user profile
router.get('/profile', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all staff members (for supervisor dashboard)
router.get('/staff', authenticate, async (req, res) => {
  try {
    // Only supervisors and managers can access staff list
    if (req.user.role !== 'supervisor' && req.user.role !== 'manager') {
      return res.status(403).json({ message: 'Access denied. Supervisor or Manager role required.' });
    }

    const staffMembers = await User.find({ role: 'staff' }).select('-password');
    res.json(staffMembers);
  } catch (error) {
    console.error('Get staff list error:', error);
    res.status(500).json({
      message: 'Server error while fetching staff list',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Failed to fetch staff list'
    });
  }
});

// Get pending registrations (manager only)
router.get('/pending-registrations', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'manager') {
      return res.status(403).json({ message: 'Access denied. Manager role required.' });
    }

    const pendingUsers = await User.find({ 
      approvalStatus: 'pending',
      isApproved: false 
    }).select('-password');
    
    res.json(pendingUsers);
  } catch (error) {
    console.error('Get pending registrations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Approve/reject registration (manager only)
router.put('/approve-registration/:userId', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'manager') {
      return res.status(403).json({ message: 'Access denied. Manager role required.' });
    }

    const { action, rejectionReason } = req.body; // action: 'approve' or 'reject'
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (action === 'approve') {
      user.isApproved = true;
      user.approvalStatus = 'approved';
      user.approvedBy = req.user._id;
      user.approvedAt = new Date();
    } else if (action === 'reject') {
      user.approvalStatus = 'rejected';
      user.rejectionReason = rejectionReason || 'No reason provided';
      user.approvedBy = req.user._id;
      user.approvedAt = new Date();
    } else {
      return res.status(400).json({ message: 'Invalid action. Use "approve" or "reject".' });
    }

    await user.save();
    
    res.json({ 
      message: `Registration ${action}d successfully`,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        approvalStatus: user.approvalStatus
      }
    });
  } catch (error) {
    console.error('Approve/reject registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all users for manager dashboard
router.get('/all-users', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'manager') {
      return res.status(403).json({ message: 'Access denied. Manager role required.' });
    }

    const users = await User.find().select('-password').populate('approvedBy', 'firstName lastName');
    res.json(users);
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reset password (manager/supervisor)
router.post('/reset-password', authenticate, async (req, res) => {
  try {
    const { targetId, targetEmail, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'New password is required (min 6 chars)' });
    }

    let targetUser = null;
    if (targetId) {
      targetUser = await User.findById(targetId);
    } else if (targetEmail) {
      targetUser = await User.findOne({ email: targetEmail });
    } else {
      return res.status(400).json({ message: 'Provide targetId or targetEmail' });
    }

    if (!targetUser) {
      return res.status(404).json({ message: 'Target user not found' });
    }

    // Permission checks
    if (req.user.role === 'supervisor') {
      if (targetUser.role !== 'staff') {
        return res.status(403).json({ message: 'Supervisors can reset passwords for staff only' });
      }
    } else if (req.user.role === 'manager') {
      if (targetUser.role !== 'staff' && targetUser.role !== 'supervisor') {
        return res.status(403).json({ message: 'Managers can reset passwords for staff or supervisors only' });
      }
    } else {
      return res.status(403).json({ message: 'Access denied' });
    }

    const salt = await bcrypt.genSalt(10);
    targetUser.password = await bcrypt.hash(newPassword, salt);
    await targetUser.save();

    res.json({ message: `Password reset successfully for ${targetUser.firstName} ${targetUser.lastName}` });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

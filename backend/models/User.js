const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  userId: String,
  email: {
    type: String,
    match: [/^[\w.-]+@bankofabyssinia\.com$/, "Please provide a valid BOA email"],
    unique: true,
  },
  role: {
    type: String,
    enum: ['staff', 'supervisor', 'manager']
  },
  password: String,
  // Registration approval system
  isApproved: {
    type: Boolean,
    default: false
  },
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  rejectionReason: String,
  // Additional fields for registration
  department: String,
  phoneNumber: String,
  registrationDate: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', userSchema);

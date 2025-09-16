
// models/Report.js
const mongoose = require('mongoose');
const reportSchema = new mongoose.Schema({
  // Template-based report linkage
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Template'
  },
  templateData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  templateVersion: {
    type: Number,
    default: 1
  },
  // Link to an original report if this is a revision of a rejected one
  revisionOf: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Report',
    default: null
  },
  // Submitter and timing
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  submissionDate: { type: Date, default: Date.now },
  // Week-based sorting fields
  weekNumber: { type: Number, default: function() {
    const date = new Date();
    const start = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date - start) / (24 * 60 * 60 * 1000));
    return Math.ceil((days + start.getDay() + 1) / 7);
  }},
  year: { type: Number, default: function() {
    return new Date().getFullYear();
  }},
  month: { type: Number, default: function() {
    return new Date().getMonth() + 1;
  }},
  day: { type: Number, default: function() {
    return new Date().getDate();
  }},
  // Review system for supervisor
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewStatus: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  reviewComments: String,
  supervisorComments: String,
  rejectionReason: String,
  reviewedAt: Date,
  // Files uploaded with the report
  files: [String]
});

/* Index for efficient sorting and filtering 1 for ascending, -1 for descending for Filtering (find) on specific fields
Sorting large collections*/
reportSchema.index({ year: 1, weekNumber: 1, submissionDate: -1 });
reportSchema.index({ submittedBy: 1, submissionDate: -1 });
reportSchema.index({ reviewStatus: 1, submissionDate: -1 });
reportSchema.index({ revisionOf: 1, submissionDate: -1 });

module.exports = mongoose.model('Report', reportSchema);
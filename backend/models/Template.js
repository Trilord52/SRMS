const mongoose = require('mongoose');

const fieldSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: false,
    enum: ['text', 'number', 'date', 'select', 'checkbox', 'textarea', 'file', 'yesno']
  },
  label: {
    type: String,
    required: false,
    trim: true
  },
  placeholder: {
    type: String,
    default: ''
  },
  defaultValue: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  required: {
    type: Boolean,
    default: false
  },
  options: [{
    value: String,
    label: String
  }],
  validators: {
    minLength: Number,
    maxLength: Number,
    min: Number,
    max: Number,
    pattern: String,
    customMessage: String
  },
  order: {
    type: Number,
    default: 0
  },
  readOnly: {
    type: Boolean,
    default: false
  }
});

const templateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['weekly', 'weekly-report', 'incident', 'incident-report', 'maintenance', 'maintenance-report', 'database-report', 'health-check', 'custom']
  },
  fields: [fieldSchema],
  isActive: {
    type: Boolean,
    default: true
  },
  version: {
    type: Number,
    default: 1
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for better query performance
templateSchema.index({ category: 1, isActive: 1 });
templateSchema.index({ createdBy: 1 });

module.exports = mongoose.model('Template', templateSchema);
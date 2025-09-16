const mongoose = require('mongoose');

const databaseSchema = new mongoose.Schema({
  database: { type: String, required: true },      // e.g., "FinanceDB"
  databaseType: { type: String, required: true },  // e.g., "PostgreSQL"
  ipAddress: { type: String, required: true },     // e.g., "192.168.1.10"
  dbVersion: { type: String, required: true },     // e.g., "12.3"
  osVersion: { type: String, required: true },     // e.g., "Ubuntu 20.04"
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Manager who added it
  createdAt: { type: Date, default: Date.now },
  // Custom features that managers can add
  customFeatures: [{
    name: { type: String, required: true },
    type: { 
      type: String, 
      enum: ['enum', 'input', 'number', 'date'],
      required: true 
    },
    label: { type: String, required: true },
    required: { type: Boolean, default: false },
    enumOptions: [String], // For enum type
    defaultValue: String,
    description: String
  }],
  isActive: { type: Boolean, default: true }
});

module.exports = mongoose.model('Database', databaseSchema);
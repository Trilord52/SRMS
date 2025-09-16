const mongoose = require('mongoose');

const fileMetadataSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  mimetype: { type: String, required: true },
  size: { type: Number, required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  uploadedAt: { type: Date, default: Date.now },
  reportId: { type: mongoose.Schema.Types.ObjectId, ref: 'Report' },
  fileType: { type: String, required: true }, // 'synchronization', 'backup', 'resource', 'general'
  // Preview information
  canPreview: { type: Boolean, default: false },
  previewUrl: String,
  thumbnailUrl: String,
  // For images
  width: Number,
  height: Number,
  // For documents
  pageCount: Number,
  documentType: String
});

fileMetadataSchema.index({ filename: 1 });
fileMetadataSchema.index({ uploadedBy: 1 });
fileMetadataSchema.index({ reportId: 1 });

module.exports = mongoose.model('FileMetadata', fileMetadataSchema);

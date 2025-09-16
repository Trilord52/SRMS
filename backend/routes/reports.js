const express = require('express');
const router = express.Router();
const Report = require('../models/Report');
const authenticate = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Template = require('../models/Template'); // Added for template management

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// Add this validation middleware
const validateTemplateData = async (req, res, next) => {
  try {
    const { templateId } = req.body;
    let templateData = req.body.templateData;
    
    if (!templateId) {
      return res.status(400).json({ message: 'Template ID is required' });
    }

    // Parse templateData if it is a JSON string (multipart/form-data case)
    if (typeof templateData === 'string') {
      try {
        templateData = JSON.parse(templateData);
      } catch (e) {
        return res.status(400).json({ message: 'Invalid templateData format. Must be valid JSON.' });
      }
    }

    const template = await Template.findById(templateId);
    if (!template || !template.isActive) {
      return res.status(400).json({ message: 'Invalid or inactive template' });
    }

    // Validate template data against template fields
    const errors = [];
    for (const field of template.fields) {
      // Skip validation for read-only info fields
      if (field.readOnly) {
        continue;
      }

      const value = templateData[field.name];
      const fieldLabel = field.label || field.name;
      
      if (field.required && (value === undefined || value === null || value === '')) {
        errors.push(`${fieldLabel} is required`);
        continue;
      }

      if (value !== undefined && value !== null && value !== '' && field.validators) {
        // Validate based on field type and validators
        if (field.type === 'text' || field.type === 'textarea') {
          if (field.validators.minLength && String(value).length < field.validators.minLength) {
            errors.push(`${fieldLabel} must be at least ${field.validators.minLength} characters`);
          }
          if (field.validators.maxLength && String(value).length > field.validators.maxLength) {
            errors.push(`${fieldLabel} must be no more than ${field.validators.maxLength} characters`);
          }
        }
        
        if (field.type === 'number') {
          const numValue = Number(value);
          if (Number.isNaN(numValue)) {
            errors.push(`${fieldLabel} must be a number`);
          } else {
            if (field.validators.min !== undefined && numValue < field.validators.min) {
              errors.push(`${fieldLabel} must be at least ${field.validators.min}`);
            }
            if (field.validators.max !== undefined && numValue > field.validators.max) {
              errors.push(`${fieldLabel} must be no more than ${field.validators.max}`);
            }
          }
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ message: 'Validation errors', errors });
    }

    req.template = template;
    req.parsedTemplateData = templateData;
    next();
  } catch (error) {
    console.error('Template validation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all reports (with role-based filtering, sorting, and pagination)
router.get('/', authenticate, async (req, res) => {
  try {
    const { 
      sortBy = 'submissionDate', 
      sortOrder = 'desc', 
      week, 
      year, 
      month, 
      day, 
      database,
      status,
      submitter, // New: filter by submitter
      reviewStatus, // New: filter by review status
      page = 1,
      limit = 9
    } = req.query;

    let filter = {};
    
    // Role-based filtering
    if (req.user.role === 'staff') {
      filter.submittedBy = req.user._id;
    } else if (req.user.role === 'supervisor') {
      // Supervisors can see all reports but can only review pending ones
      // No additional filtering needed
    }
    // Managers can see all reports

    // Week-based filtering
    if (week && year) {
      filter.weekNumber = parseInt(week);
      filter.year = parseInt(year);
    }

    // Date-based filtering
    if (year) filter.year = parseInt(year);
    if (month) filter.month = parseInt(month);
    if (day) filter.day = parseInt(day);

    // Database filtering
    if (database) filter.database = database;

    // Status filtering
    if (status) {
      if (status === 'completed') {
        filter.$and = [
          { synchronization: 'Yes' },
          { backupCompletion: 'Yes' },
          { resourceAvailability: 'Yes' }
        ];
      } else if (status === 'pending') {
        filter.$or = [
          { synchronization: 'No' },
          { backupCompletion: 'No' },
          { resourceAvailability: 'No' }
        ];
      }
    }

    // Filter by submitter (manager/supervisor only)
    if (submitter && (req.user.role === 'manager' || req.user.role === 'supervisor')) {
      filter.submittedBy = submitter;
    }

    // Filter by review status
    if (reviewStatus) {
      filter.reviewStatus = reviewStatus;
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reports, totalCount] = await Promise.all([
      Report.find(filter)
        .populate('submittedBy', 'firstName lastName email userId')
        .populate('reviewedBy', 'firstName lastName')
        .populate('templateId', 'name category version')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Report.countDocuments(filter)
    ]);

    res.json({
      reports,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        hasNextPage: skip + reports.length < totalCount,
        hasPrevPage: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get reports by week (with pagination)
router.get('/week/:weekNumber', authenticate, async (req, res) => {
  try {
    const { weekNumber } = req.params;
    const { year = new Date().getFullYear(), page = 1, limit = 9 } = req.query;
    
    let filter = { weekNumber: parseInt(weekNumber), year: parseInt(year) };
    
    if (req.user.role === 'staff') {
      filter.submittedBy = req.user._id;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reports, totalCount] = await Promise.all([
      Report.find(filter)
        .populate('submittedBy', 'firstName lastName email userId')
        .populate('reviewedBy', 'firstName lastName')
        .sort({ submissionDate: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Report.countDocuments(filter)
    ]);

    res.json({
      reports,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        hasNextPage: skip + reports.length < totalCount,
        hasPrevPage: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Get reports by week error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get reports by date range (with pagination)
router.get('/date-range', authenticate, async (req, res) => {
  try {
    const { startDate, endDate, database, page = 1, limit = 9 } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'Start date and end date are required' });
    }

    let filter = {
      submissionDate: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    };

    if (database) filter.database = database;
    
    if (req.user.role === 'staff') {
      filter.submittedBy = req.user._id;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reports, totalCount] = await Promise.all([
      Report.find(filter)
        .populate('submittedBy', 'firstName lastName email userId')
        .populate('reviewedBy', 'firstName lastName')
        .sort({ submissionDate: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Report.countDocuments(filter)
    ]);

    res.json({
      reports,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        hasNextPage: skip + reports.length < totalCount,
        hasPrevPage: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Get reports by date range error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get weekly summary
router.get('/weekly-summary', authenticate, async (req, res) => {
  try {
    const { year = new Date().getFullYear() } = req.query;
    
    let filter = { year: parseInt(year) };
    
    if (req.user.role === 'staff') {
      filter.submittedBy = req.user._id;
    }

    const weeklySummary = await Report.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { week: '$weekNumber', year: '$year' },
          count: { $sum: 1 },
          completed: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$synchronization', 'Yes'] },
                    { $eq: ['$backupCompletion', 'Yes'] },
                    { $eq: ['$resourceAvailability', 'Yes'] }
                  ]
                },
                1,
                0
              ]
            }
          },
          pending: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ['$synchronization', 'No'] },
                    { $eq: ['$backupCompletion', 'No'] },
                    { $eq: ['$resourceAvailability', 'No'] }
                  ]
                },
                1,
                0
              ]
            }
          },
          pendingReview: {
            $sum: {
              $cond: [
                { $eq: ['$reviewStatus', 'pending'] },
                1,
                0
              ]
            }
          },
          approved: {
            $sum: {
              $cond: [
                { $eq: ['$reviewStatus', 'approved'] },
                1,
                0
              ]
            }
          },
          rejected: {
            $sum: {
              $cond: [
                { $eq: ['$reviewStatus', 'rejected'] },
                1,
                0
              ]
            }
          }
        }
      },
      { $sort: { '_id.year': 1, '_id.week': 1 } }
    ]);

    res.json(weeklySummary);
  } catch (error) {
    console.error('Get weekly summary error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Export reports
router.get('/export', authenticate, async (req, res) => {
  try {
    const format = req.query.format || 'json';
    const { week, year, month, day, reviewStatus, submitter, templateId, templateIds } = req.query;
    
    let filter = {};
    
    // Role-based filtering
    if (req.user.role === 'staff') {
      filter.submittedBy = req.user._id;
    }

    // Apply additional filters
    if (week && year) {
      filter.weekNumber = parseInt(week);
      filter.year = parseInt(year);
    }
    if (year) filter.year = parseInt(year);
    if (month) filter.month = parseInt(month);
    if (day) filter.day = parseInt(day);
    if (submitter && (req.user.role === 'manager' || req.user.role === 'supervisor')) {
      filter.submittedBy = submitter;
    }
    if (reviewStatus) {
      filter.reviewStatus = reviewStatus;
    }
    if (templateId) {
      filter.templateId = templateId;
    }
    if (templateIds) {
      const ids = Array.isArray(templateIds) ? templateIds : String(templateIds).split(',');
      filter.templateId = { $in: ids };
    }

    let reports = await Report.find(filter)
      .populate('submittedBy', 'firstName lastName email userId')
      .populate('reviewedBy', 'firstName lastName')
      .populate('templateId', 'name category version');

    if (format === 'csv') {
      const csvHeader = 'Template Name,Template Category,Template Version,Submitted By,Submission Date,Week,Year,Review Status,Reviewed By,Supervisor Comments,Rejection Reason\n';
      const csvData = reports.map(report => {
        return `"${report.templateId?.name || ''}","${report.templateId?.category || ''}","${report.templateVersion || ''}","${report.submittedBy?.firstName} ${report.submittedBy?.lastName}","${new Date(report.submissionDate).toISOString()}","${report.weekNumber}","${report.year}","${report.reviewStatus}","${report.reviewedBy ? report.reviewedBy.firstName + ' ' + report.reviewedBy.lastName : ''}","${report.supervisorComments || ''}","${report.rejectionReason || ''}"`;
      }).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=reports_${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csvHeader + csvData);
    } else if (format === 'excel') {
      const excelData = reports.map(report => ({
        'Template Name': report.templateId?.name || '',
        'Template Category': report.templateId?.category || '',
        'Template Version': report.templateVersion || '',
        'Submitted By': `${report.submittedBy?.firstName} ${report.submittedBy?.lastName}`,
        'Submission Date': new Date(report.submissionDate).toISOString(),
        Week: report.weekNumber,
        Year: report.year,
        'Review Status': report.reviewStatus,
        'Reviewed By': report.reviewedBy ? `${report.reviewedBy.firstName} ${report.reviewedBy.lastName}` : '',
        'Supervisor Comments': report.supervisorComments || '',
        'Rejection Reason': report.rejectionReason || ''
      }));
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=reports_${new Date().toISOString().split('T')[0]}.json`);
      res.json(excelData);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=reports_${new Date().toISOString().split('T')[0]}.json`);
      res.json(reports);
    }
  } catch (error) {
    console.error('Export reports error:', error);
    res.status(500).json({ message: 'Server error during export' });
  }
});

// Get reports by database
router.get('/database/:databaseName', authenticate, async (req, res) => {
  try {
    const { databaseName } = req.params;
    const { page = 1, limit = 9 } = req.query;
    let reports;
    
    let filter = { database: databaseName };
    
    if (req.user.role === 'staff') {
      filter.submittedBy = req.user._id;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reportsData, totalCount] = await Promise.all([
      Report.find(filter)
        .populate('submittedBy', 'firstName lastName email userId')
        .populate('reviewedBy', 'firstName lastName')
        .sort({ submissionDate: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Report.countDocuments(filter)
    ]);
    
    res.json({
      reports: reportsData,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        hasNextPage: skip + reportsData.length < totalCount,
        hasPrevPage: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Get reports by database error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new report with individual file uploads
router.post('/', authenticate, upload.array('files'), validateTemplateData, async (req, res) => {
  try {
    const { templateId, templateVersion, revisionOf } = req.body;
    const templateData = req.parsedTemplateData || req.body.templateData || {};

    const report = new Report({
      submittedBy: req.user._id,
      submissionDate: new Date(),
      templateId,
      templateData: new Map(Object.entries(templateData)),
      templateVersion: templateVersion || req.template.version,
      reviewStatus: 'pending',
      revisionOf: revisionOf || null
    });

    if (req.files && req.files.length > 0) {
      report.files = req.files.map(file => file.filename || path.basename(file.path));
    }

    await report.save();
    await report.populate('templateId', 'name version');

    res.status(201).json(report);
  } catch (error) {
    console.error('Error creating report:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a single report
router.get('/:id', authenticate, async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate('submittedBy', 'firstName lastName email userId')
      .populate('reviewedBy', 'firstName lastName');
    
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    // Check if user has access to this report
    if (req.user.role === 'staff' && report.submittedBy._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(report);
  } catch (error) {
    console.error('Get single report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update a report with individual file uploads
router.put('/:id', authenticate, upload.fields([
  { name: 'synchronizationFiles', maxCount: 5 },
  { name: 'backupFiles', maxCount: 5 },
  { name: 'resourceFiles', maxCount: 5 },
  { name: 'files', maxCount: 5 }
]), async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    // Check if user has access to this report
    if (req.user.role === 'staff' && report.submittedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const updateData = { ...req.body };
    
    // Handle individual file uploads
    if (req.files?.synchronizationFiles) {
      updateData.synchronizationFiles = [...(report.synchronizationFiles || []), ...req.files.synchronizationFiles.map(file => file.filename)];
    }
    if (req.files?.backupFiles) {
      updateData.backupFiles = [...(report.backupFiles || []), ...req.files.backupFiles.map(file => file.filename)];
    }
    if (req.files?.resourceFiles) {
      updateData.resourceFiles = [...(report.resourceFiles || []), ...req.files.resourceFiles.map(file => file.filename)];
    }
    if (req.files?.files) {
      updateData.files = [...(report.files || []), ...req.files.files.map(file => file.filename)];
    }

    const updatedReport = await Report.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('submittedBy', 'firstName lastName email userId')
     .populate('reviewedBy', 'firstName lastName');

    res.json(updatedReport);
  } catch (error) {
    console.error('Update report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Review a report (supervisor only)
router.put('/:id/review', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'supervisor' && req.user.role !== 'manager') {
      return res.status(403).json({ message: 'Access denied. Supervisor or Manager role required.' });
    }

    const { reviewStatus, reviewComments, supervisorComments, rejectionReason } = req.body;
    const report = await Report.findById(req.params.id);
    
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    report.reviewStatus = reviewStatus;
    report.reviewComments = reviewComments;
    if (reviewStatus === 'approved') {
      report.supervisorComments = supervisorComments || reviewComments || '';
      report.rejectionReason = '';
    } else if (reviewStatus === 'rejected') {
      report.supervisorComments = supervisorComments || '';
      report.rejectionReason = rejectionReason || 'Rejected';
    } else {
      // pending
      report.supervisorComments = supervisorComments || '';
      report.rejectionReason = '';
    }
    report.reviewedBy = req.user._id;
    report.reviewedAt = new Date();

    await report.save();
    
    const updatedReport = await Report.findById(report._id)
      .populate('submittedBy', 'firstName lastName email userId')
      .populate('reviewedBy', 'firstName lastName');

    res.json(updatedReport);
  } catch (error) {
    console.error('Review report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Download a file
router.get('/download/:filename', authenticate, async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, '../uploads', filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Check if user has access to this file by finding a report that contains it
    let hasAccess = false;
    if (req.user.role === 'manager' || req.user.role === 'supervisor') {
      hasAccess = true;
    } else {
      const report = await Report.findOne({
        $or: [
          { synchronizationFiles: filename },
          { backupFiles: filename },
          { resourceFiles: filename },
          { files: filename }
        ],
        submittedBy: req.user._id
      });
      hasAccess = !!report;
    }

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied to this file' });
    }

    res.download(filePath);
  } catch (error) {
    console.error('Download file error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a report (manager only)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'manager') {
      return res.status(403).json({ message: 'Access denied. Manager role required.' });
    }

    const report = await Report.findById(req.params.id);
    
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    // Delete associated files
    const allFiles = [
      ...(report.synchronizationFiles || []),
      ...(report.backupFiles || []),
      ...(report.resourceFiles || []),
      ...(report.files || [])
    ];

    allFiles.forEach(filename => {
      const filePath = path.join(__dirname, '../uploads', filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });

    await Report.findByIdAndDelete(req.params.id);
    res.json({ message: 'Report deleted successfully' });
  } catch (error) {
    console.error('Delete report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Bulk delete reports (manager only)
router.delete('/bulk-delete', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'manager') {
      return res.status(403).json({ message: 'Access denied. Manager role required.' });
    }

    const { reportIds } = req.body;
    
    if (!reportIds || !Array.isArray(reportIds) || reportIds.length === 0) {
      return res.status(400).json({ message: 'Invalid report IDs provided' });
    }

    // Find all reports to be deleted
    const reports = await Report.find({ _id: { $in: reportIds } });
    
    if (reports.length === 0) {
      return res.status(404).json({ message: 'No reports found' });
    }

    // Delete associated files
    const allFiles = [];
    reports.forEach(report => {
      allFiles.push(
        ...(report.synchronizationFiles || []),
        ...(report.backupFiles || []),
        ...(report.resourceFiles || []),
        ...(report.files || [])
      );
    });

    // Remove duplicate filenames
    const uniqueFiles = [...new Set(allFiles)];

    uniqueFiles.forEach(filename => {
      const filePath = path.join(__dirname, '../uploads', filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });

    // Delete all reports
    await Report.deleteMany({ _id: { $in: reportIds } });
    
    res.json({ 
      message: `${reports.length} report(s) deleted successfully`,
      deletedCount: reports.length
    });
  } catch (error) {
    console.error('Bulk delete reports error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

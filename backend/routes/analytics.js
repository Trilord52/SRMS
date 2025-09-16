const express = require('express');
const router = express.Router();
const Report = require('../models/Report');
const User = require('../models/User');
const authenticate = require('../middleware/auth');

// Get detailed analytics dashboard
router.get('/dashboard', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'manager' && req.user.role !== 'supervisor') {
      return res.status(403).json({ message: 'Access denied. Manager or Supervisor role required.' });
    }

    const { 
      period = 'weekly', 
      startDate, 
      endDate, 
      staffId,
      sortBy = 'submissionDate',
      sortOrder = 'desc'
    } = req.query;

    let dateFilter = {};
    const now = new Date();

    // Set date range based on period
    switch (period) {
      case 'daily':
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        dateFilter = {
          submissionDate: {
            $gte: today,
            $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
          }
        };
        break;
      case 'weekly':
        const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        dateFilter = {
          submissionDate: { $gte: weekStart }
        };
        break;
      case 'monthly':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        dateFilter = {
          submissionDate: { $gte: monthStart }
        };
        break;
      case 'annually':
        const yearStart = new Date(now.getFullYear(), 0, 1);
        dateFilter = {
          submissionDate: { $gte: yearStart }
        };
        break;
      case 'custom':
        if (startDate && endDate) {
          dateFilter = {
            submissionDate: {
              $gte: new Date(startDate),
              $lte: new Date(endDate)
            }
          };
        }
        break;
    }

    // Add staff filter if provided
    if (staffId) {
      dateFilter.submittedBy = staffId;
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Get reports for the period
    const reports = await Report.find(dateFilter)
      .populate('submittedBy', 'firstName lastName email userId department')
      .populate('reviewedBy', 'firstName lastName')
      .populate('templateId', 'name')
      .sort(sort);

    // Calculate analytics based on reviewStatus only
    const totalReports = reports.length;
    const approvedCount = reports.filter(r => r.reviewStatus === 'approved').length;
    const pendingCount = reports.filter(r => r.reviewStatus === 'pending').length;
    const rejectedCount = reports.filter(r => r.reviewStatus === 'rejected').length;

    const analytics = {
      period,
      totalReports,
      completedReports: approvedCount,
      pendingReports: pendingCount,
      reviewStats: {
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount
      },
      performanceMetrics: {
        completionRate: totalReports > 0 ? ((approvedCount / totalReports) * 100).toFixed(2) : 0,
        averageResponseTime: calculateAverageResponseTime(reports),
        submissionTrend: normalizeTrendLabels(calculateSubmissionTrend(reports, period))
      }
    };

    // Staff performance breakdown
    const staffPerformance = await calculateStaffPerformance(reports, period);

    // Database/template performance breakdown
    const databasePerformance = await calculateDatabasePerformance(reports);

    res.json({
      analytics,
      staffPerformance,
      databasePerformance,
      recentReports: reports.slice(0, 10) // Last 10 reports
    });
  } catch (error) {
    console.error('Analytics dashboard error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get staff performance analytics
router.get('/staff-performance', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'manager' && req.user.role !== 'supervisor') {
      return res.status(403).json({ message: 'Access denied. Manager or Supervisor role required.' });
    }

    const { 
      period = 'monthly', 
      staffId,
      sortBy = 'performance',
      sortOrder = 'desc'
    } = req.query;

    let dateFilter = {};
    const now = new Date();

    // Set date range based on period
    switch (period) {
      case 'daily':
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        dateFilter = {
          submissionDate: {
            $gte: today,
            $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
          }
        };
        break;
      case 'weekly':
        const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        dateFilter = {
          submissionDate: { $gte: weekStart }
        };
        break;
      case 'monthly':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        dateFilter = {
          submissionDate: { $gte: monthStart }
        };
        break;
      case 'annually':
        const yearStart = new Date(now.getFullYear(), 0, 1);
        dateFilter = {
          submissionDate: { $gte: yearStart }
        };
        break;
    }

    if (staffId) {
      dateFilter.submittedBy = staffId;
    }

    const reports = await Report.find(dateFilter)
      .populate('submittedBy', 'firstName lastName email userId department')
      .populate('reviewedBy', 'firstName lastName')
      .populate('templateId', 'name');

    const staffPerformance = await calculateStaffPerformance(reports, period, sortBy, sortOrder);

    res.json(staffPerformance);
  } catch (error) {
    console.error('Staff performance analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get database performance analytics
router.get('/database-performance', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'manager' && req.user.role !== 'supervisor') {
      return res.status(403).json({ message: 'Access denied. Manager or Supervisor role required.' });
    }

    const { period = 'monthly' } = req.query;

    let dateFilter = {};
    const now = new Date();

    // Set date range based on period
    switch (period) {
      case 'daily':
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        dateFilter = {
          submissionDate: {
            $gte: today,
            $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
          }
        };
        break;
      case 'weekly':
        const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        dateFilter = {
          submissionDate: { $gte: weekStart }
        };
        break;
      case 'monthly':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        dateFilter = {
          submissionDate: { $gte: monthStart }
        };
        break;
      case 'annually':
        const yearStart = new Date(now.getFullYear(), 0, 1);
        dateFilter = {
          submissionDate: { $gte: yearStart }
        };
        break;
    }

    const reports = await Report.find(dateFilter)
      .populate('submittedBy', 'firstName lastName email userId department')
      .populate('reviewedBy', 'firstName lastName')
      .populate('templateId', 'name');

    const databasePerformance = await calculateDatabasePerformance(reports);

    res.json(databasePerformance);
  } catch (error) {
    console.error('Database performance analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper functions
function calculateAverageResponseTime(reports) {
  const reviewedReports = reports.filter(r => r.reviewedAt && r.submissionDate);
  if (reviewedReports.length === 0) return 0;

  const totalTime = reviewedReports.reduce((sum, report) => {
    return sum + (new Date(report.reviewedAt) - new Date(report.submissionDate));
  }, 0);

  return Math.round(totalTime / reviewedReports.length / (1000 * 60 * 60)); // Hours
}

function calculateSubmissionTrend(reports, period) {
  const now = new Date();
  const trend = [];

  switch (period) {
    case 'daily':
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        const count = reports.filter(r => {
          const reportDate = new Date(r.submissionDate);
          return reportDate >= dayStart && reportDate < dayEnd;
        }).length;
        trend.push({ label: dayStart.toISOString().split('T')[0], count });
      }
      break;
    case 'weekly':
      for (let i = 3; i >= 0; i--) {
        const weekStart = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
        const count = reports.filter(r => {
          const reportDate = new Date(r.submissionDate);
          return reportDate >= weekStart && reportDate < weekEnd;
        }).length;
        trend.push({ label: `W${Math.ceil((weekStart - new Date(weekStart.getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000))}`, count });
      }
      break;
    case 'monthly':
      for (let i = 11; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
        const count = reports.filter(r => {
          const reportDate = new Date(r.submissionDate);
          return reportDate >= monthStart && reportDate < monthEnd;
        }).length;
        trend.push({ label: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), count });
      }
      break;
    case 'annually':
      for (let i = 4; i >= 0; i--) {
        const year = now.getFullYear() - i;
        const yearStart = new Date(year, 0, 1);
        const yearEnd = new Date(year + 1, 0, 1);
        const count = reports.filter(r => {
          const reportDate = new Date(r.submissionDate);
          return reportDate >= yearStart && reportDate < yearEnd;
        }).length;
        trend.push({ label: String(year), count });
      }
      break;
  }
  return trend;
}

function normalizeTrendLabels(trend) {
  // Already normalized to {label, count}
  return trend;
}

async function calculateStaffPerformance(reports, period, sortBy = 'performance', sortOrder = 'desc') {
  const staffMap = new Map();

  reports.forEach(report => {
    if (!report.submittedBy) return;
    const staffId = report.submittedBy._id.toString();
    const staffName = `${report.submittedBy.firstName} ${report.submittedBy.lastName}`;
    if (!staffMap.has(staffId)) {
      staffMap.set(staffId, {
        staffId,
        staffName,
        email: report.submittedBy.email,
        department: report.submittedBy.department,
        totalReports: 0,
        approvedReports: 0,
        pendingReports: 0,
        reviewStats: { pending: 0, approved: 0, rejected: 0 },
        averageResponseTime: 0,
        lastSubmission: null,
        performanceScore: 0
      });
    }
    const staff = staffMap.get(staffId);
    staff.totalReports++;
    if (report.reviewStatus) {
      staff.reviewStats[report.reviewStatus]++;
      if (report.reviewStatus === 'approved') staff.approvedReports++;
      if (report.reviewStatus === 'pending') staff.pendingReports++;
    }
    if (report.submissionDate) {
      const submissionDate = new Date(report.submissionDate);
      if (!staff.lastSubmission || submissionDate > staff.lastSubmission) {
        staff.lastSubmission = submissionDate;
      }
    }
    if (report.reviewedAt && report.submissionDate) {
      const responseTime = new Date(report.reviewedAt) - new Date(report.submissionDate);
      staff.averageResponseTime = (staff.averageResponseTime * (staff.totalReports - 1) + responseTime) / staff.totalReports;
    }
  });

  // Calculate performance score
  staffMap.forEach(staff => {
    const completionRate = staff.totalReports > 0 ? staff.approvedReports / staff.totalReports : 0;
    const reviewApprovalRate = staff.totalReports > 0 ? staff.reviewStats.approved / staff.totalReports : 0;
    const responseTimeScore = staff.averageResponseTime > 0 ? Math.max(0, 1 - (staff.averageResponseTime / (24 * 60 * 60 * 1000))) : 1; // 24 hours max
    staff.performanceScore = Math.round((completionRate * 0.4 + reviewApprovalRate * 0.4 + responseTimeScore * 0.2) * 100);
    staff.averageResponseTime = Math.round(staff.averageResponseTime / (1000 * 60 * 60)); // hours
  });

  const staffArray = Array.from(staffMap.values());
  switch (sortBy) {
    case 'performance':
      return sortOrder === 'asc' ? staffArray.sort((a, b) => a.performanceScore - b.performanceScore) : staffArray.sort((a, b) => b.performanceScore - a.performanceScore);
    case 'totalReports':
      return sortOrder === 'asc' ? staffArray.sort((a, b) => a.totalReports - b.totalReports) : staffArray.sort((a, b) => b.totalReports - a.totalReports);
    case 'completedReports':
      return sortOrder === 'asc' ? staffArray.sort((a, b) => a.approvedReports - b.approvedReports) : staffArray.sort((a, b) => b.approvedReports - a.approvedReports);
    case 'lastSubmission':
      return sortOrder === 'asc' ? staffArray.sort((a, b) => new Date(a.lastSubmission) - new Date(b.lastSubmission)) : staffArray.sort((a, b) => new Date(b.lastSubmission) - new Date(a.lastSubmission));
    case 'staffName':
      return sortOrder === 'asc' ? staffArray.sort((a, b) => a.staffName.localeCompare(b.staffName)) : staffArray.sort((a, b) => b.staffName.localeCompare(a.staffName));
    case 'department':
      return sortOrder === 'asc' ? staffArray.sort((a, b) => (a.department || '').localeCompare(b.department || '')) : staffArray.sort((a, b) => (b.department || '').localeCompare(a.department || ''));
    default:
      return sortOrder === 'asc' ? staffArray.sort((a, b) => a.performanceScore - b.performanceScore) : staffArray.sort((a, b) => b.performanceScore - a.performanceScore);
  }
}

async function calculateDatabasePerformance(reports) {
  const databaseMap = new Map();

  reports.forEach(report => {
    const name = report.templateId?.name || 'Unknown Template';
    if (!databaseMap.has(name)) {
      databaseMap.set(name, {
        database: name,
        totalReports: 0,
        approvedReports: 0,
        pendingReports: 0,
        reviewStats: { pending: 0, approved: 0, rejected: 0 },
        averageResponseTime: 0,
        lastReport: null,
        performanceScore: 0
      });
    }
    const db = databaseMap.get(name);
    db.totalReports++;
    if (report.reviewStatus) {
      db.reviewStats[report.reviewStatus]++;
      if (report.reviewStatus === 'approved') db.approvedReports++;
      if (report.reviewStatus === 'pending') db.pendingReports++;
    }
    if (report.submissionDate) {
      const submissionDate = new Date(report.submissionDate);
      if (!db.lastReport || submissionDate > db.lastReport) {
        db.lastReport = submissionDate;
      }
    }
    if (report.reviewedAt && report.submissionDate) {
      const responseTime = new Date(report.reviewedAt) - new Date(report.submissionDate);
      db.averageResponseTime = (db.averageResponseTime * (db.totalReports - 1) + responseTime) / db.totalReports;
    }
  });

  databaseMap.forEach(db => {
    const completionRate = db.totalReports > 0 ? db.approvedReports / db.totalReports : 0;
    const reviewApprovalRate = db.totalReports > 0 ? db.reviewStats.approved / db.totalReports : 0;
    const responseTimeScore = db.averageResponseTime > 0 ? Math.max(0, 1 - (db.averageResponseTime / (24 * 60 * 60 * 1000))) : 1;
    db.performanceScore = Math.round((completionRate * 0.4 + reviewApprovalRate * 0.4 + responseTimeScore * 0.2) * 100);
    db.averageResponseTime = Math.round(db.averageResponseTime / (1000 * 60 * 60));
    // Attach counts used by frontend
    db.count = db.totalReports;
    db.reportsCount = db.totalReports;
  });

  return Array.from(databaseMap.values()).sort((a, b) => b.performanceScore - a.performanceScore);
}

module.exports = router;

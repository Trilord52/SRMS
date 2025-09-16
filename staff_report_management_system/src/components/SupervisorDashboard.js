import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './SupervisorDashboard.css';
import LoadingSpinner from './shared/LoadingSpinner';
import KeyboardShortcuts from './shared/KeyboardShortcuts';
import FilePreview from './shared/FilePreview';
import SupervisorSidebar from './supervisor/SupervisorSidebar';
import FiltersToolbar from './shared/FiltersToolbar';
import ReportCard from './shared/ReportCard';
import './shared/FileUploadSection.css';
import './shared/FiltersToolbar.css';
import './shared/ReportCard.css';
import './shared/FiltersToolbar.dark.css';
import './shared/ReportCard.dark.css';
import './shared/FileUploadSection.dark.css';
import DynamicForm from './shared/DynamicForm';
import ManagerAnalytics from './manager/ManagerAnalytics';
// Modular components
import SupervisorOverview from './supervisor/overview/Overview';
import SupervisorReports from './supervisor/reports/Reports';
import SupervisorCreateReport from './supervisor/createReport/CreateReport';
import SupervisorSettings from './supervisor/settings/Settings';
import SupervisorPasswordReset from './supervisor/PasswordReset';

const SupervisorDashboard = () => {
  const [user, setUser] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Sorting and filtering state
  const [sortBy, setSortBy] = useState('submissionDate');
  const [sortOrder, setSortOrder] = useState('desc');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedWeek, setSelectedWeek] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedStatus, setSelectedStatus] = useState('');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize, setPageSize] = useState(9);

  // Review modal state
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reviewData, setReviewData] = useState({
    reviewStatus: 'pending',
    supervisorComments: '',
    rejectionReason: ''
  });

  // File preview state
  const [previewFile, setPreviewFile] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewFilename, setPreviewFilename] = useState('');
 
  // View report details modal
  const [viewReport, setViewReport] = useState(null);
  const [viewTemplate, setViewTemplate] = useState(null);

  // Settings
  const [settings, setSettings] = useState({
    emailNotifications: true,
    weeklyReminders: true,
    autoSave: true,
    timezone: 'UTC+3',
    theme: 'light'
  });

  const [templates, setTemplates] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateData, setTemplateData] = useState({});
  const [templateErrors, setTemplateErrors] = useState({});
  const [templateSearch, setTemplateSearch] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user'));
    if (!userData || userData.role !== 'supervisor') {
      navigate('/login');
      return;
    }
    setUser(userData);
  }, [navigate]);

  useEffect(() => {
    if (user) {
      fetchReports();
      fetchTemplates();
      fetchStaffList();
    }
  }, [user, currentPage, pageSize, sortBy, sortOrder, selectedWeek, selectedYear, selectedStatus, dateRange]);

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [darkMode]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        sortBy,
        sortOrder,
        page: currentPage,
        limit: pageSize,
        ...(selectedWeek && { week: selectedWeek }),
        ...(selectedYear && { year: selectedYear }),
        ...(selectedStatus && { status: selectedStatus }),
        ...(dateRange.startDate && { startDate: dateRange.startDate }),
        ...(dateRange.endDate && { endDate: dateRange.endDate })
      });

      const response = await fetch(`http://localhost:5000/reports?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setReports(data);
          setTotalPages(1);
          setTotalCount(data.length);
        } else if (data.reports && Array.isArray(data.reports)) {
          setReports(data.reports);
          setTotalPages(data.pagination?.totalPages || 1);
          setTotalCount(data.pagination?.totalCount || 0);
        } else {
          setReports([]);
          setTotalPages(1);
          setTotalCount(0);
        }
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
      setReports([]);
      setTotalPages(1);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/templates/available', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setTemplates(data);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const handleTemplateSelect = async (templateId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/templates/${templateId}/schema`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const template = await response.json();
        setSelectedTemplate(template);
        setTemplateData({});
        setTemplateErrors({});
      }
    } catch (error) {
      console.error('Error fetching template schema:', error);
    }
  };

  const handleTemplateDataChange = (data) => setTemplateData(data);

  const handleCreateReport = async (e) => {
    e.preventDefault();
    if (!selectedTemplate) {
      window.showToast('Please select a template first', 'warning');
      return;
    }
    const errors = {};
    selectedTemplate.fields.forEach(field => {
      if (field.readOnly) return;
      const value = templateData[field.name];
      const labelText = field.label || field.name;
      if (field.required && (!value || value === '')) {
        errors[field.name] = `${labelText} is required`;
      }
    });
    if (Object.keys(errors).length > 0) {
      setTemplateErrors(errors);
      window.showToast('Please fix the validation errors', 'warning');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const formDataToSend = new FormData();
      formDataToSend.append('templateId', selectedTemplate._id);
      formDataToSend.append('templateData', JSON.stringify(templateData));
      formDataToSend.append('templateVersion', selectedTemplate.version);
      Object.keys(templateData).forEach(key => {
        const value = templateData[key];
        if (value instanceof FileList) {
          Array.from(value).forEach(file => formDataToSend.append('files', file));
        }
      });
      const response = await fetch('http://localhost:5000/reports', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formDataToSend
      });
      if (response.ok) {
        window.showToast('Report submitted successfully!', 'success');
        setSelectedTemplate(null);
        setTemplateData({});
        setTemplateErrors({});
        fetchReports();
      } else {
        const errorData = await response.json();
        window.showToast(errorData.message || 'Failed to submit report', 'error');
      }
    } catch (error) {
      console.error('Error creating report:', error);
      window.showToast('Network error. Please try again.', 'error');
    }
  };

  // Review functions
  const handleReviewReport = (report) => {
    setSelectedReport(report);
    setReviewData({
      reviewStatus: report.reviewStatus || 'pending',
      supervisorComments: report.supervisorComments || '',
      rejectionReason: report.rejectionReason || ''
    });
    setShowReviewModal(true);
  };

  const submitReview = async () => {
    if (!selectedReport) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/reports/${selectedReport._id}/review`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reviewStatus: reviewData.reviewStatus,
          supervisorComments: reviewData.supervisorComments,
          rejectionReason: reviewData.rejectionReason,
          reviewedBy: user._id,
          reviewedAt: new Date().toISOString()
        })
      });
      if (response.ok) {
        const action = reviewData.reviewStatus === 'approved' ? 'approved' : 'rejected';
        window.showToast(`Report ${action} successfully!`, 'success');
        setShowReviewModal(false);
        setSelectedReport(null);
        fetchReports();
      } else {
        const errorData = await response.json();
        window.showToast(errorData.message || 'Failed to review report', 'error');
      }
    } catch (error) {
      console.error('Error reviewing report:', error);
      window.showToast('Network error. Please try again.', 'error');
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const getReportStats = () => {
    const reportsArray = Array.isArray(reports) ? reports : [];
    const totalReports = totalCount;
    const pendingReview = reportsArray.filter(report => report.reviewStatus === 'pending').length;
    const approvedReports = reportsArray.filter(report => report.reviewStatus === 'approved').length;
    const rejectedReports = reportsArray.filter(report => report.reviewStatus === 'rejected').length;
    return { totalReports, pendingReview, approvedReports, rejectedReports };
  };

  const handleFilterChange = () => {
    fetchReports();
  };

  const getWeekOptions = () => {
    const weeks = [];
    for (let i = 1; i <= 53; i++) weeks.push(i);
    return weeks;
  };

  const getYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear - 2; i <= currentYear + 1; i++) years.push(i);
    return years;
  };

  const handleSortChange = (newSortBy) => {
    if (sortBy === newSortBy) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortBy(newSortBy); setSortOrder('desc'); }
  };

  const getFilteredReports = () => {
    const reportsArray = Array.isArray(reports) ? reports : [];
    if (filterStatus === 'all') return reportsArray;
    return reportsArray.filter(report => report.reviewStatus === filterStatus);
  };

  const handleStatusFilter = (status) => {
    setFilterStatus(status);
  };
 
  const openViewReport = async (report) => {
    try {
      setViewReport(report);
      setViewTemplate(null);
      const token = localStorage.getItem('token');
      const templateId = report.templateId?._id || report.templateId;
      if (!templateId) return;
      const response = await fetch(`http://localhost:5000/api/templates/${templateId}/schema`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const tpl = await response.json();
        setViewTemplate(tpl);
      }
    } catch (e) {
      console.error('Error loading template for view:', e);
    }
  };
 
  const closeViewReport = () => {
    setViewReport(null);
    setViewTemplate(null);
  };

  const fetchStaffList = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/auth/staff', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setStaffList(data);
      }
    } catch (error) {
      console.error('Error fetching staff list:', error);
    }
  };

  const renderContent = () => {
    const stats = getReportStats();

    switch (activeTab) {
      case 'overview':
        return (
          <>
            <SupervisorOverview staffOptions={staffList} />
            <div className="stats-grid">
              <div className={`stat-card ${filterStatus === 'all' ? 'active' : ''}`} onClick={() => handleStatusFilter('all')} style={{ cursor: 'pointer' }}>
                <div className="stat-icon">📊</div>
                <div className="stat-content">
                  <h3>{stats.totalReports}</h3>
                  <p>All Reports</p>
                </div>
              </div>
              <div className={`stat-card ${filterStatus === 'pending' ? 'active' : ''}`} onClick={() => handleStatusFilter('pending')} style={{ cursor: 'pointer' }}>
                <div className="stat-icon">⏳</div>
                <div className="stat-content">
                  <h3>{stats.pendingReview}</h3>
                  <p>Pending Review</p>
                </div>
              </div>
              <div className={`stat-card ${filterStatus === 'approved' ? 'active' : ''}`} onClick={() => handleStatusFilter('approved')} style={{ cursor: 'pointer' }}>
                <div className="stat-icon">✅</div>
                <div className="stat-content">
                  <h3>{stats.approvedReports}</h3>
                  <p>Approved</p>
                </div>
              </div>
              <div className={`stat-card ${filterStatus === 'rejected' ? 'active' : ''}`} onClick={() => handleStatusFilter('rejected')} style={{ cursor: 'pointer' }}>
                <div className="stat-icon">❌</div>
                <div className="stat-content">
                  <h3>{stats.rejectedReports}</h3>
                  <p>Rejected</p>
                </div>
              </div>
            </div>
            <div className="reports-section">
              <div className="section-header">
                <h2>{filterStatus === 'all' ? 'All Reports' : `${filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)} Reports`}</h2>
              </div>
              {getFilteredReports().length === 0 ? (
                <p className="no-reports">No {filterStatus === 'all' ? '' : filterStatus} reports found.</p>
              ) : (
                <div className="reports-grid">
                  {getFilteredReports().slice(0, 6).map(report => (
                    <div key={report._id} className="report-card">
                      <div className="report-header">
                        <h3>{report.templateId?.name ? `${report.templateId.name} (${report.templateId.category || ''})` : 'Template Report'}</h3>
                        <div className="report-meta">
                          <span className="report-date">{new Date(report.submissionDate).toLocaleDateString()}</span>
                          <span className={`review-status ${report.reviewStatus}`}>{report.reviewStatus}</span>
                        </div>
                      </div>
                      <div className="report-details">
                        <p><strong>Submitted by:</strong> {report.submittedBy?.firstName} {report.submittedBy?.lastName}</p>
                        {report.rejectionReason && (<p><strong>Rejection:</strong> {report.rejectionReason}</p>)}
                      </div>
                      <div className="report-actions">
                        <button onClick={() => openViewReport(report)} className="review-btn">View</button>
                        <button onClick={() => handleReviewReport(report)} className={`review-btn ${report.reviewStatus === 'pending' ? 'pending' : ''}`}>
                          {report.reviewStatus === 'pending' ? 'Review' : 'Update Review'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        );
      
      case 'reports':
        return (
          <SupervisorReports
            reports={reports}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={(value) => handleSortChange(value)}
              onToggleSortOrder={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              weekOptions={getWeekOptions()}
              selectedWeek={selectedWeek}
              onWeekChange={(value) => { setSelectedWeek(value); handleFilterChange(); }}
              yearOptions={getYearOptions()}
              selectedYear={selectedYear}
              onYearChange={(value) => { setSelectedYear(value); handleFilterChange(); }}
              selectedStatus={selectedStatus}
              onStatusChange={(value) => { setSelectedStatus(value); handleFilterChange(); }}
              dateRange={dateRange}
              onDateStartChange={(value) => { setDateRange({ ...dateRange, startDate: value }); handleFilterChange(); }}
              onDateEndChange={(value) => { setDateRange({ ...dateRange, endDate: value }); handleFilterChange(); }}
            onClearFilters={() => { setSelectedWeek(''); setSelectedYear(new Date().getFullYear()); setSelectedStatus(''); setDateRange({ startDate: '', endDate: '' }); handleFilterChange(); }}
            openViewReport={openViewReport}
            handleReviewReport={handleReviewReport}
            totalPages={totalPages}
            currentPage={currentPage}
            onPageChange={handlePageChange}
            totalCount={totalCount}
            FiltersToolbar={FiltersToolbar}
          />
        );
      
      case 'create-report':
        return (
          <SupervisorCreateReport
            templates={templates}
            templateSearch={templateSearch}
            setTemplateSearch={setTemplateSearch}
            selectedTemplate={selectedTemplate}
            onSelectTemplate={handleTemplateSelect}
            onSubmit={handleCreateReport}
            formData={templateData}
            onChange={handleTemplateDataChange}
            errors={templateErrors}
            submitting={false}
          />
        );

      case 'settings':
        return (
          <SupervisorSettings user={user} darkMode={darkMode} setDarkMode={setDarkMode} settings={settings} setSettings={setSettings} />
        );
      
      case 'password-reset':
        return (
          <SupervisorPasswordReset />
        );
      default:
        return null;
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="dashboard-container">
      <SupervisorSidebar
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        onLogout={() => {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          navigate('/login');
        }}
      />
      <div className={`main-content ${sidebarCollapsed ? 'expanded' : ''}`}>
        {renderContent()}
      </div>

      {showReviewModal && selectedReport && (
        <div className="modal-overlay">
          <div className="modal large-modal">
            <div className="modal-header">
              <h2>Review Report - {selectedReport.templateId?.name ? `${selectedReport.templateId.name} (${selectedReport.templateId.category || ''})` : 'Template Report'}</h2>
              <button onClick={() => setShowReviewModal(false)} className="close-btn">×</button>
            </div>
            <div className="modal-content">
              <div className="form-group">
                <label>Review Status</label>
                <select 
                  value={reviewData.reviewStatus}
                  onChange={(e) => setReviewData({ ...reviewData, reviewStatus: e.target.value })}
                  className="review-select"
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div className="form-group">
                <label>Supervisor Comments</label>
                <textarea
                  value={reviewData.supervisorComments}
                  onChange={(e) => setReviewData({ ...reviewData, supervisorComments: e.target.value })}
                  rows="4"
                  placeholder="Add your supervisor comments..."
                  className="review-textarea"
                />
              </div>
              {reviewData.reviewStatus === 'rejected' && (
                <div className="form-group">
                  <label>Rejection Reason (Required for rejection)</label>
                  <textarea
                    value={reviewData.rejectionReason}
                    onChange={(e) => setReviewData({ ...reviewData, rejectionReason: e.target.value })}
                    rows="3"
                    placeholder="Please provide a reason for rejection..."
                    className="review-textarea"
                    required
                  />
                </div>
              )}
              <div className="form-actions">
                <button 
                  onClick={submitReview}
                  className="submit-btn"
                  disabled={reviewData.reviewStatus === 'rejected' && !reviewData.rejectionReason.trim()}
                >
                  Submit Review
                </button>
                <button onClick={() => setShowReviewModal(false)} className="cancel-btn">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Report Modal */}
      {viewReport && (
        <div className="modal-overlay">
          <div className="modal large-modal">
            <div className="modal-header">
              <h2>Report Details - {viewReport.templateId?.name ? `${viewReport.templateId.name} (${viewReport.templateId.category || ''})` : 'Template Report'}</h2>
              <button onClick={closeViewReport} className="close-btn">×</button>
            </div>
            <div className="modal-content">
              <div className="info-section">
                <h3>Submitter</h3>
                <p><strong>Name:</strong> {viewReport.submittedBy?.firstName} {viewReport.submittedBy?.lastName}</p>
                <p><strong>Email:</strong> {viewReport.submittedBy?.email}</p>
                <p><strong>Submitted:</strong> {new Date(viewReport.submissionDate).toLocaleString()}</p>
                <p><strong>Status:</strong> {viewReport.reviewStatus}</p>
                {viewReport.rejectionReason && (<p><strong>Rejection Reason:</strong> {viewReport.rejectionReason}</p>)}
              </div>
              <div className="info-section">
                <h3>Report Data</h3>
                {!viewTemplate ? (
                  <div>Loading template...</div>
                ) : (
                  <div className="dynamic-form">
                    <div className="form-fields">
                      {viewTemplate.fields
                        .sort((a,b) => (a.order||0)-(b.order||0))
                        .map(field => (
                          <div key={field.name} className={`form-group ${field.type==='textarea' ? 'full' : ''}`}>
                            <div className="field-title">{String(field.name).replace(/[_-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</div>
                            {field.label && <div className="field-description">{field.label}</div>}
                            <div className="readonly-info">{String(viewReport.templateData?.[field.name] ?? '')}</div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showPreview && (
        <FilePreview
          file={previewFile}
          filename={previewFilename}
          onClose={() => setShowPreview(false)}
        />
      )}

      <KeyboardShortcuts
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        onRefresh={() => { fetchReports(); }}
        onExport={() => { window.showToast('Export functionality coming soon!', 'info'); }}
        onSearch={() => { window.showToast('Search functionality coming soon!', 'info'); }}
        userRole="supervisor"
      />
    </div>
  );
};

export default SupervisorDashboard;
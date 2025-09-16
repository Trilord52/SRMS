import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './StaffDashboard.css';
import './staff/Sidebar.css';
import './staff/Pagination.css';
import './shared/FileUploadSection.css';
import './shared/FiltersToolbar.css';
import './shared/ReportCard.css';

import './shared/DynamicForm.css';
import './shared/FiltersToolbar.dark.css';
import './shared/ReportCard.dark.css';
import './shared/FileUploadSection.dark.css';
import LoadingSpinner from './shared/LoadingSpinner';
import KeyboardShortcuts from './shared/KeyboardShortcuts';
import FilePreview from './shared/FilePreview';
import StaffSidebar from './staff/StaffSidebar';
import StaffPagination from './staff/StaffPagination'; // TODO: remove if no longer used

import FileUploadSection from './shared/FileUploadSection';
import FiltersToolbar from './shared/FiltersToolbar';
import ReportCard from './shared/ReportCard';
import DynamicForm from './shared/DynamicForm';
import './shared/TemplateSelection.css';

const StaffDashboard = () => {
  const [user, setUser] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [activeTab, setActiveTab] = useState('reports');
  const [darkMode, setDarkMode] = useState(false);
  const [settings, setSettings] = useState({
    emailNotifications: true,
    weeklyReminders: true,
    autoSave: true,
    timezone: 'UTC+3',
    theme: 'light'
  });
  
  // Sorting and filtering state
  const [sortBy, setSortBy] = useState('submissionDate');
  const [sortOrder, setSortOrder] = useState('desc');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize, setPageSize] = useState(9);
  const [selectedWeek, setSelectedWeek] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedDatabase, setSelectedDatabase] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  
  // File preview state
  const [previewFile, setPreviewFile] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewFilename, setPreviewFilename] = useState('');
  
  // Template system state
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateData, setTemplateData] = useState({});
  const [templateErrors, setTemplateErrors] = useState({});
  const [templateSearch, setTemplateSearch] = useState('');
  
  // Bulk operations state
  const [selectedReports, setSelectedReports] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  
  // Auto-save state
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [lastSaved, setLastSaved] = useState(null);
  const [autoSaveTimer, setAutoSaveTimer] = useState(null);
  
  const [editingReport, setEditingReport] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editingData, setEditingData] = useState({});
  const [editingErrors, setEditingErrors] = useState({});
  
  const navigate = useNavigate();

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user'));
    if (!userData || userData.role !== 'staff') {
      navigate('/login');
      return;
    }
    setUser(userData);
    
    // Load saved settings
    const savedSettings = localStorage.getItem('staffSettings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setSettings(parsed);
      setDarkMode(parsed.theme === 'dark');
    }
  }, [navigate]);

  useEffect(() => {
    if (user) {
      fetchReports();
      fetchTemplates();
    }
  }, [user, currentPage, pageSize]);

  useEffect(() => {
    // Apply dark mode
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [darkMode]);

  const fetchReports = async () => {
    try {
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

  const handleTemplateDataChange = (data) => {
    setTemplateData(data);
  };

  const handleCreateReport = async (e) => {
    e.preventDefault();
    if (!selectedTemplate) {
      window.showToast('Please select a template first', 'warning');
      return;
    }

    // Validate template data
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

    setSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      const formDataToSend = new FormData();
      formDataToSend.append('templateId', selectedTemplate._id);
      formDataToSend.append('templateData', JSON.stringify(templateData));
      formDataToSend.append('templateVersion', selectedTemplate.version);

      // Handle file uploads
      Object.keys(templateData).forEach(key => {
        const value = templateData[key];
        if (value instanceof FileList) {
          Array.from(value).forEach(file => {
            formDataToSend.append('files', file);
          });
        }
      });

      const response = await fetch('http://localhost:5000/reports', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
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
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async (filename) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/reports/download/${filename}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        window.showToast(`File "${filename}" downloaded successfully!`, 'success');
      } else {
        const errorData = await response.json();
        window.showToast(errorData.message || 'Failed to download file', 'error');
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      window.showToast('Network error. Please try again.', 'error');
    }
  };

  const handleSortChange = (newSortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
  };

  const handleFilterChange = () => {
    fetchReports();
  };

  const getWeekOptions = () => {
    const weeks = [];
    for (let i = 1; i <= 53; i++) {
      weeks.push(i);
    }
    return weeks;
  };

  const getYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear - 2; i <= currentYear + 1; i++) {
      years.push(i);
    }
    return years;
  };

  const startEditRejected = async (report) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/templates/${report.templateId}/schema`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const tpl = await response.json();
        setEditingTemplate(tpl);
        setEditingReport(report);
        // Pre-fill with previous data
        const prev = report.templateData || {};
        setEditingData(prev);
        setEditingErrors({});
        setActiveTab('reports');
        window.scrollTo(0, 0);
      }
    } catch (e) {
      console.error('Error loading template for edit:', e);
    }
  };

  const submitEditedReport = async (e) => {
    e.preventDefault();
    if (!editingTemplate || !editingReport) return;
    const errors = {};
    editingTemplate.fields.forEach(field => {
      if (field.readOnly) return;
      const value = editingData[field.name];
      const labelText = field.label || field.name;
      if (field.required && (!value || value === '')) {
        errors[field.name] = `${labelText} is required`;
      }
    });
    if (Object.keys(errors).length > 0) {
      setEditingErrors(errors);
      window.showToast('Please fix the validation errors', 'warning');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const formDataToSend = new FormData();
      formDataToSend.append('templateId', editingTemplate._id);
      formDataToSend.append('templateData', JSON.stringify(editingData));
      formDataToSend.append('templateVersion', editingTemplate.version);
      formDataToSend.append('revisionOf', editingReport._id);
      Object.keys(editingData).forEach(key => {
        const value = editingData[key];
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
        window.showToast('Edited report submitted successfully!', 'success');
        setEditingReport(null);
        setEditingTemplate(null);
        setEditingData({});
        setEditingErrors({});
        fetchReports();
      } else {
        const errorData = await response.json();
        window.showToast(errorData.message || 'Failed to submit edited report', 'error');
      }
    } catch (error) {
      console.error('Error submitting edited report:', error);
      window.showToast('Network error. Please try again.', 'error');
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'reports':
        return (
          <>
            <div className="content-header">
              <h1>Weekly Reports</h1>
              <p>Create and manage your weekly database reports</p>
            </div>

            {!selectedTemplate ? (
              <div className="template-selection">
                <h2>Select a Template</h2>
                <p>Choose a template to create your report</p>

                <div className="templates-grid-controls">
                  <input
                    type="text"
                    placeholder="Search templates..."
                    value={templateSearch}
                    onChange={(e) => setTemplateSearch(e.target.value)}
                    className="templates-search"
                  />
                </div>
                
                <div className="templates-grid">
                  {templates
                    .filter(t => t.name.toLowerCase().includes(templateSearch.toLowerCase()))
                    .map(template => (
                    <div 
                      key={template._id} 
                      className="template-card"
                      onClick={() => handleTemplateSelect(template._id)}
                    >
                      <h3>{template.name}</h3>
                      <p>{template.description}</p>
                      <span className="template-category">{template.category}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
            <div className="form-container">
              <div className="form-title">
                  <h2>Create New Report - {selectedTemplate.name}</h2>
                  <p>{selectedTemplate.description}</p>
                  <button
                    onClick={() => {
                      setSelectedTemplate(null);
                      setTemplateData({});
                      setTemplateErrors({});
                    }}
                    className="change-template-btn"
                  >
                    Change Template
                  </button>
              </div>
              
              <form onSubmit={handleCreateReport} className="report-form">
                  <DynamicForm
                    template={selectedTemplate}
                    formData={templateData}
                    onChange={handleTemplateDataChange}
                    errors={templateErrors}
                />

                <div className="form-actions">
                  <button 
                    type="submit" 
                    className={`submit-btn ${submitting ? 'btn-loading' : ''}`}
                    disabled={submitting}
                  >
                    {submitting ? 'Submitting...' : 'Submit Report'}
                  </button>
                  <button 
                    type="button" 
                      onClick={() => {
                        setSelectedTemplate(null);
                        setTemplateData({});
                        setTemplateErrors({});
                      }}
                    className="cancel-btn"
                    disabled={submitting}
                  >
                    Reset Form
                  </button>
                </div>
              </form>
            </div>
            )}
          </>
        );
      case 'history':
        return (
          <>
            <div className="content-header">
              <h1>Report History</h1>
              <p>View and manage your submitted reports</p>
            </div>

            <FiltersToolbar
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
              onClearFilters={() => {
                    setSelectedWeek('');
                    setSelectedYear(new Date().getFullYear());
                    setSelectedStatus('');
                    setDateRange({ startDate: '', endDate: '' });
                    handleFilterChange();
                  }}
            />

            {!selectedTemplate && editingTemplate ? (
              <div className="form-container">
                <div className="form-title">
                  <h2>Edit Rejected Report - {editingTemplate.name}</h2>
                  <p>{editingTemplate.description}</p>
                  <button 
                    onClick={() => { setEditingReport(null); setEditingTemplate(null); setEditingData({}); setEditingErrors({}); }}
                    className="change-template-btn"
                  >
                    Cancel Edit
                  </button>
                </div>
                <form onSubmit={submitEditedReport} className="report-form">
                  <DynamicForm template={editingTemplate} formData={editingData} onChange={setEditingData} errors={editingErrors} />
                  <div className="form-actions">
                    <button type="submit" className={`submit-btn ${submitting ? 'btn-loading' : ''}`} disabled={submitting}>Submit Edited Report</button>
                  </div>
                </form>
              </div>
            ) : null}
            <div className="reports-section">
              <h2>My Reports</h2>
              {(Array.isArray(reports) ? reports : []).length === 0 ? (
                <p className="no-reports">No reports found. Create your first report!</p>
              ) : (
                <div className="reports-grid">
                  {(Array.isArray(reports) ? reports : []).map(report => (
                    <ReportCard
                      key={report._id}
                      report={report}
                      isSelected={selectedReports.includes(report._id)}
                      onToggleSelect={() => setSelectedReports(prev => prev.includes(report._id) ? prev.filter(id => id !== report._id) : [...prev, report._id])}
                      onPreviewFile={(file) => { setPreviewFile(file); setShowPreview(true); }}
                      onDownloadFile={() => {}}
                      onEdit={() => startEditRejected(report)}
                      hasRevision={reports.some(r => r.revisionOf === report._id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <StaffSidebar
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        sidebarCollapsed={false}
        onToggleSidebar={() => {}}
        onLogout={() => {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          navigate('/login');
        }}
      />

      {/* Main Content */}
      <div className={`main-content ${false ? 'expanded' : ''}`}>
        {renderContent()}
      </div>

      {/* Keyboard Shortcuts */}
      <KeyboardShortcuts
        onNewReport={() => setShowCreateForm(true)}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        onToggleSidebar={() => {}}
        onRefresh={() => {
          fetchReports();
          fetchTemplates();
        }}
        onExport={() => {
          window.showToast('Export functionality coming soon!', 'info');
        }}
        onSearch={() => {
          window.showToast('Search functionality coming soon!', 'info');
        }}
        userRole="staff"
      />

      {/* File Preview Modal */}
      {showPreview && (
        <FilePreview
          file={previewFile}
          filename={previewFilename}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
};

export default StaffDashboard;
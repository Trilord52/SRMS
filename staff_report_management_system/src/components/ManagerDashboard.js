import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './ManagerDashboard.css';
import LoadingSpinner from './shared/LoadingSpinner';
import KeyboardShortcuts from './shared/KeyboardShortcuts';
import FilePreview from './shared/FilePreview';
import ManagerSidebar from './manager/ManagerSidebar';
import FiltersToolbar from './shared/FiltersToolbar';
import ReportCard from './shared/ReportCard';
import ManagerAnalytics from './manager/ManagerAnalytics';
import UsersGrid from './manager/users/UsersGrid';
import './manager/users/Users.css';
import './staff/Sidebar.css';
import './shared/FiltersToolbar.dark.css';
import './shared/ReportCard.dark.css';
import './shared/FileUploadSection.dark.css';
import './manager/users/Users.dark.css';
import './manager/ReportCard.manager.css';
import './manager/users/Users.manager.css';
import TemplateManager from './manager/TemplateManager';
import './manager/TemplateManager.css';
import DynamicForm from './shared/DynamicForm';
import './shared/DynamicForm.css';
import './shared/TemplateSelection.css';

// Modular components
import ManagerOverview from './manager/overview/Overview';
import ManagerStaffManagement from './manager/staff/StaffManagement';
import ManagerStaffReports from './manager/staffReports/StaffReports';
import ManagerTemplates from './manager/templates/Templates';
import ManagerSettings from './manager/settings/Settings';
import ManagerPasswordReset from './manager/PasswordReset';

const ManagerDashboard = () => {
  const [user, setUser] = useState(null);
  const [reports, setReports] = useState([]);
  const [databases, setDatabases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [showDatabaseForm, setShowDatabaseForm] = useState(false);
  const [showEditDatabaseForm, setShowEditDatabaseForm] = useState(false);
  const [editingDatabase, setEditingDatabase] = useState(null);
  const [selectedDatabase, setSelectedDatabase] = useState(null); // Used in staff-reports case
  const [activeTab, setActiveTab] = useState('overview');
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settings, setSettings] = useState({
    emailNotifications: true,
    weeklyReminders: true,
    autoSave: true,
    timezone: 'UTC+3',
    theme: 'light',
    showAnalytics: true,
    exportReports: true
  });
  const [databaseFormData, setDatabaseFormData] = useState({
    database: '',
    databaseType: '',
    ipAddress: '',
    dbVersion: '',
    osVersion: '',
    customFeatures: []
  });
  const [staffList, setStaffList] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState(null);

  // User approval state
  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [approvingUser, setApprovingUser] = useState(null);
  const [error, setError] = useState(null); // Added for user approval errors

  // Custom features state
  const [customFeatures, setCustomFeatures] = useState([]);
  const [newCustomFeature, setNewCustomFeature] = useState({
    name: '',
    type: 'input',
    label: '',
    enumOptions: '',
    defaultValue: '',
    required: false
  });

  // Bulk operations state
  const [selectedDatabases, setSelectedDatabases] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Sorting and filtering state
  const [sortBy, setSortBy] = useState('submissionDate');
  const [sortOrder, setSortOrder] = useState('desc');

  // Analytics sorting state
  const [analyticsPeriod, setAnalyticsPeriod] = useState('weekly');
  const [analyticsSortBy, setAnalyticsSortBy] = useState('submissionDate');
  const [analyticsSortOrder, setAnalyticsSortOrder] = useState('desc');

  // Analytics data state
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedDatabaseFilter, setSelectedDatabaseFilter] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize, setPageSize] = useState(9);

  // File preview state
  const [previewFile, setPreviewFile] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewFilename, setPreviewFilename] = useState('');

  // Template management state
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateData, setTemplateData] = useState({});
  const [templateErrors, setTemplateErrors] = useState({});

  const navigate = useNavigate();



  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const [staffReportsTemplateSearch, setStaffReportsTemplateSearch] = useState('');
  const [staffReportsUserSearch, setStaffReportsUserSearch] = useState('');
  

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user'));
    if (!userData || userData.role !== 'manager') {
      navigate('/login');
      return;
    }
    setUser(userData);

    // Load saved settings
    const savedSettings = localStorage.getItem('managerSettings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setSettings(parsed);
      setDarkMode(parsed.theme === 'dark');
    }
  }, [navigate]);

  useEffect(() => {
    if (user) {
      setLoading(true);
      Promise.all([
        fetchReports(),
        fetchDatabases(),
        fetchStaffList(),
        fetchPendingUsers(),
        fetchAllUsers()
      ]).finally(() => setLoading(false));
    }
  }, [user]);

  useEffect(() => {
    // Apply dark mode
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [darkMode]);

  // Handle escape key for closing modals
  useEffect(() => {
    const handleEscape = () => {
      if (showDatabaseForm) {
        setShowDatabaseForm(false);
      }
    };
    window.addEventListener('escapePressed', handleEscape);
    return () => {
      window.removeEventListener('escapePressed', handleEscape);
    };
  }, [showDatabaseForm]);

  useEffect(() => {
    fetchReports();
  }, [currentPage, pageSize, sortBy, sortOrder, selectedWeek, selectedYear, selectedDatabaseFilter, selectedStatus, dateRange]);

  useEffect(() => {
    fetchAnalytics();
  }, [analyticsPeriod, analyticsSortBy, analyticsSortOrder]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      // Build query parameters for sorting and filtering
      const params = new URLSearchParams({
        sortBy,
        sortOrder,
        page: currentPage,
        limit: pageSize,
        ...(selectedWeek && { week: selectedWeek }),
        ...(selectedYear && { year: selectedYear }),
        ...(selectedDatabaseFilter && { database: selectedDatabaseFilter }),
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
        // Handle both old format (array) and new format (object with reports and pagination)
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
      setReports([]); // Set empty array on error
      setTotalPages(1);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const fetchAnalytics = async () => {
    try {
      setAnalyticsLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        period: analyticsPeriod,
        sortBy: analyticsSortBy,
        sortOrder: analyticsSortOrder
      });
      const response = await fetch(`http://localhost:5000/analytics/dashboard?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setAnalyticsData(data);
      } else {
        console.error('Failed to fetch analytics:', response.status);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      window.showToast('Failed to fetch analytics', 'error');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const fetchDatabases = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/databases', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setDatabases(data);
      }
    } catch (error) {
      console.error('Error fetching databases:', error);
    }
  };

  const fetchStaffList = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/auth/staff', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setStaffList(data);
      }
    } catch (error) {
      console.error('Error fetching staff list:', error);
    }
  };

  const fetchPendingUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/auth/pending-registrations', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setPendingUsers(data);
      } else {
        setError('Failed to fetch pending users');
      }
    } catch (error) {
      console.error('Error fetching pending users:', error);
      setError('Network error fetching pending users');
    }
  };

  const fetchAllUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/auth/all-users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setAllUsers(data);
      } else {
        setError('Failed to fetch all users');
      }
    } catch (error) {
      console.error('Error fetching all users:', error);
      setError('Network error fetching all users');
    }
  };

  const handleUserApproval = async (userId, action, rejectionReason = '') => {
    setApprovingUser(userId);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/auth/approve-registration/${userId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action, rejectionReason })
      });
      if (response.ok) {
        const data = await response.json();
        window.showToast(data.message, 'success');
        fetchPendingUsers();
        fetchAllUsers();
      } else {
        const errorData = await response.json();
        window.showToast(errorData.message || 'Failed to process request', 'error');
      }
    } catch (error) {
      console.error('Error processing user approval:', error);
      window.showToast('Network error. Please try again.', 'error');
    } finally {
      setApprovingUser(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleCreateDatabase = async (e) => {
    e.preventDefault();
    if (!window.confirm('Create this database with the provided details?')) return;
    setSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      const formDataWithCustomFeatures = {
        ...databaseFormData,
        customFeatures: customFeatures
      };

      const response = await fetch('http://localhost:5000/databases', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formDataWithCustomFeatures)
      });
      if (response.ok) {
        window.showToast('Database created successfully!', 'success');
        setShowDatabaseForm(false);
        setDatabaseFormData({
          database: '',
          databaseType: '',
          ipAddress: '',
          dbVersion: '',
          osVersion: '',
          customFeatures: []
        });
        setCustomFeatures([]);
        fetchDatabases();
      } else {
        const errorData = await response.json();
        window.showToast(errorData.message || 'Failed to create database', 'error');
      }
    } catch (error) {
      console.error('Error creating database:', error);
      window.showToast('Network error. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Custom features functions
  const addCustomFeature = () => {
    if (!newCustomFeature.name.trim()) {
      window.showToast('Please enter a feature name', 'warning');
      return;
    }

    if (!newCustomFeature.label.trim()) {
      window.showToast('Please enter a feature label', 'warning');
      return;
    }

    const feature = {
      ...newCustomFeature,
      label: newCustomFeature.label.trim(),
      enumOptions: newCustomFeature.type === 'enum' ? newCustomFeature.enumOptions.split(',').map(opt => opt.trim()) : []
    };

    setCustomFeatures([...customFeatures, feature]);
    setNewCustomFeature({
      name: '',
      type: 'input',
      label: '',
      enumOptions: '',
      defaultValue: '',
      required: false
    });
  };

  const removeCustomFeature = (index) => {
    setCustomFeatures(customFeatures.filter((_, i) => i !== index));
  };

  const handleCustomFeatureChange = (field, value) => {
    setNewCustomFeature({
      ...newCustomFeature,
      [field]: value
    });
  };

  const handleInputChange = (e) => {
    setDatabaseFormData({
      ...databaseFormData,
      [e.target.name]: e.target.value
    });
  };

  const handleSettingsChange = (setting, value) => {
    const newSettings = { ...settings, [setting]: value };
    setSettings(newSettings);

    // Handle dark mode toggle
    if (setting === 'theme') {
      setDarkMode(value === 'dark');
      newSettings.theme = value;
    }

    // Save to localStorage
    localStorage.setItem('managerSettings', JSON.stringify(newSettings));
  };

  const deleteDatabase = async (databaseId) => {
    if (!window.confirm('Are you sure you want to delete this database? This will also delete all associated reports.')) return;

    setDeleting(databaseId);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/databases/${databaseId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        window.showToast('Database deleted successfully!', 'success');
        fetchDatabases();
        fetchReports();
      } else {
        const errorData = await response.json();
        window.showToast(errorData.message || 'Failed to delete database', 'error');
      }
    } catch (error) {
      console.error('Error deleting database:', error);
      window.showToast('Network error. Please try again.', 'error');
    } finally {
      setDeleting(null);
    }
  };

  const handleEditDatabase = (database) => {
    setEditingDatabase(database);
    setDatabaseFormData({
      database: database.database,
      databaseType: database.databaseType,
      ipAddress: database.ipAddress,
      dbVersion: database.dbVersion,
      osVersion: database.osVersion,
      customFeatures: database.customFeatures || []
    });
    setCustomFeatures(database.customFeatures || []);
    setShowEditDatabaseForm(true);
  };

  const handleUpdateDatabase = async (e) => {
    e.preventDefault();
    if (!window.confirm('Save changes to this database?')) return;
    setSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      const formDataWithCustomFeatures = {
        ...databaseFormData,
        customFeatures: customFeatures
      };

      const response = await fetch(`http://localhost:5000/databases/${editingDatabase._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formDataWithCustomFeatures)
      });
      if (response.ok) {
        window.showToast('Database updated successfully!', 'success');
        setShowEditDatabaseForm(false);
        setEditingDatabase(null);
        setDatabaseFormData({
          database: '',
          databaseType: '',
          ipAddress: '',
          dbVersion: '',
          osVersion: '',
          customFeatures: []
        });
        setCustomFeatures([]);
        fetchDatabases();
      } else {
        const errorData = await response.json();
        window.showToast(errorData.message || 'Failed to update database', 'error');
      }
    } catch (error) {
      console.error('Error updating database:', error);
      window.showToast('Network error. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getReportsByDatabase = () => {
    return [];
  };

  const getReportStats = () => {
    const reportsArray = Array.isArray(reports) ? reports : [];
    const totalReports = reportsArray.length;
    const approvedReports = reportsArray.filter(r => r.reviewStatus === 'approved').length;
    const pendingReports = reportsArray.filter(r => r.reviewStatus === 'pending').length;
    return { totalReports, approvedReports, pendingReports };
  };

  const getReportsByStaff = (staffId) => {
    const reportsArray = Array.isArray(reports) ? reports : [];
    return reportsArray.filter(report => report.submittedBy?._id === staffId);
  };

  const getStaffSubmissionStatus = (staffId) => {
    const staffReports = getReportsByStaff(staffId);
    const thisWeek = new Date();
    thisWeek.setDate(thisWeek.getDate() - 7);

    const recentReports = staffReports.filter(report =>
      new Date(report.submissionDate) >= thisWeek
    );

    return {
      total: staffReports.length,
      thisWeek: recentReports.length,
      lastSubmission: staffReports.length > 0 ?
        new Date(staffReports[staffReports.length - 1].submissionDate) : null
    };
  };

  const getApprovedReports = () => {
    const list = Array.isArray(reports) ? reports : [];
    return list.filter(r => r.reviewStatus === 'approved');
  };

  const filterReportsBySearch = (list) => {
    const tQuery = staffReportsTemplateSearch.trim().toLowerCase();
    const uQuery = staffReportsUserSearch.trim().toLowerCase();
    return list.filter(r => {
      const templateName = (r.templateId?.name || '').toLowerCase();
      const userName = `${r.submittedBy?.firstName || ''} ${r.submittedBy?.lastName || ''}`.trim().toLowerCase();
      const userEmail = (r.submittedBy?.email || '').toLowerCase();
      const tOk = tQuery ? templateName.includes(tQuery) : true;
      const uOk = uQuery ? (userName.includes(uQuery) || userEmail.includes(uQuery)) : true;
      return tOk && uOk;
    });
  };

  const exportReports = async (format = 'csv') => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({ format, reviewStatus: 'approved' });
      const res = await fetch(`http://localhost:5000/reports/export?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json();
        return window.showToast(err.message || 'Failed to export reports', 'error');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reports_${new Date().toISOString().split('T')[0]}.${format === 'csv' ? 'csv' : (format === 'excel' ? 'json' : 'json')}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      window.showToast('Reports exported successfully', 'success');
    } catch (e) {
      console.error('Export reports error', e);
      window.showToast('Failed to export reports', 'error');
    }
  };

  const exportTemplates = async (format = 'csv') => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({ format });
      const res = await fetch(`http://localhost:5000/api/templates/export?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json();
        return window.showToast(err.message || 'Failed to export templates', 'error');
      }
      const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
      a.download = `templates_${new Date().toISOString().split('T')[0]}.${format === 'csv' ? 'csv' : 'json'}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      window.showToast('Templates exported successfully', 'success');
    } catch (e) {
      console.error('Export templates error', e);
      window.showToast('Failed to export templates', 'error');
    }
  };

  // Helper functions for sorting and filtering
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

  const handleFilePreview = (fileOrName) => {
    if (typeof fileOrName === 'string') {
      setPreviewFile(null);
      setPreviewFilename(fileOrName);
    } else if (fileOrName && typeof fileOrName === 'object') {
      setPreviewFile(fileOrName);
      setPreviewFilename(fileOrName.name || 'file');
    } else {
      return;
    }
    setShowPreview(true);
  };

  // Bulk operations functions
  const handleSelectDatabase = (databaseId) => {
    setSelectedDatabases(prev =>
      prev.includes(databaseId)
        ? prev.filter(id => id !== databaseId)
        : [...prev, databaseId]
    );
  };

  const handleSelectAllDatabases = () => {
    if (selectedDatabases.length === databases.length) {
      setSelectedDatabases([]);
    } else {
      setSelectedDatabases(databases.map(database => database._id));
    }
  };

  const bulkDeleteDatabases = async () => {
    if (selectedDatabases.length === 0) {
      window.showToast('Please select databases to delete', 'warning');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete ${selectedDatabases.length} selected database(s)?`)) {
      return;
    }
    setBulkDeleting(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/databases/bulk-delete', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ databaseIds: selectedDatabases })
      });

      if (response.ok) {
        window.showToast(`${selectedDatabases.length} database(s) deleted successfully!`, 'success');
        setSelectedDatabases([]);
        fetchDatabases();
      } else {
        const errorData = await response.json();
        window.showToast(errorData.message || 'Failed to delete databases', 'error');
      }
    } catch (error) {
      console.error('Error bulk deleting databases:', error);
      window.showToast('Network error. Please try again.', 'error');
    } finally {
      setBulkDeleting(false);
    }
  };

  const bulkExportDatabases = () => {
    if (selectedDatabases.length === 0) {
      window.showToast('Please select databases to export', 'warning');
      return;
    }
    // For now, just show a toast. Actual export functionality can be implemented later
    window.showToast(`Exporting ${selectedDatabases.length} selected database(s)...`, 'info');
  };

  const fetchTemplates = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/templates', {
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

  const renderContent = () => {
    const stats = getReportStats();
    switch (activeTab) {
      case 'overview':
        return (
          <ManagerOverview staffOptions={staffList} period={analyticsPeriod} onLoadingChange={setAnalyticsLoading} />
        );

      case 'staff':
        return (
          <ManagerStaffManagement
            staffList={staffList}
            getStaffSubmissionStatus={getStaffSubmissionStatus}
            getReportsByStaff={getReportsByStaff}
            onSelectStaff={(staff) => { setSelectedStaff(staff); setActiveTab('staff-reports'); }}
          />
        );

      case 'staff-reports':
        return (
          <ManagerStaffReports
            reports={reports}
            onPreviewFile={handleFilePreview}
            onDownloadFile={handleDownload}
            exportReports={exportReports}
            templateSearch={staffReportsTemplateSearch}
            setTemplateSearch={setStaffReportsTemplateSearch}
            userSearch={staffReportsUserSearch}
            setUserSearch={setStaffReportsUserSearch}
          />
        );

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
                    .filter(t => {
                      const q = templateSearch.toLowerCase();
                      return t.name.toLowerCase().includes(q);
                    })
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
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
          </>
        );

      case 'databases':
        return (
          <>
            <div className="content-header">
              <h1>Database Management</h1>
              <p>Manage and monitor all databases</p>
            </div>
            <div className="databases-section">
              <div className="section-header">
                <h2>Databases</h2>
                <button
                  onClick={() => setShowDatabaseForm(true)}
                  className="add-btn"
                >
                  Add Database
                </button>
              </div>

              {/* Bulk Operations */}
              {databases.length > 0 && (
                <div className="bulk-operations">
                  <div className="bulk-controls">
                    <label className="select-all-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedDatabases.length === databases.length && databases.length > 0}
                        onChange={handleSelectAllDatabases}
                      />
                      Select All ({selectedDatabases.length}/{databases.length})
                    </label>

                    {selectedDatabases.length > 0 && (
                      <div className="bulk-actions">
                        <button
                          onClick={bulkDeleteDatabases}
                          className={`bulk-delete-btn ${bulkDeleting ? 'btn-loading' : ''}`}
                          disabled={bulkDeleting}
                        >
                          {bulkDeleting ? 'Deleting...' : `Delete Selected (${selectedDatabases.length})`}
                        </button>
                        <button
                          onClick={bulkExportDatabases}
                          className="bulk-export-btn"
                        >
                          Export Selected ({selectedDatabases.length})
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="databases-grid">
                {databases.map(database => (
                  <div key={database._id} className="database-card">
                    <div className="database-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedDatabases.includes(database._id)}
                        onChange={() => handleSelectDatabase(database._id)}
                      />
                    </div>
                    <div className="database-header">
                      <h3>{database.database}</h3>
                      <button
                        onClick={() => handleEditDatabase(database)}
                        className="edit-btn"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteDatabase(database._id)}
                        className={`delete-btn ${deleting === database._id ? 'btn-loading' : ''}`}
                        disabled={deleting === database._id}
                      >
                        {deleting === database._id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>

                    <div className="database-details">
                      <p><strong>Type:</strong> {database.databaseType}</p>
                      <p><strong>IP Address:</strong> {database.ipAddress}</p>
                      <p><strong>OS Version:</strong> {database.osVersion}</p>
                      <p><strong>Reports:</strong> {getReportsByDatabase(database.database).length}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        );

      case 'settings':
        return (
          <ManagerSettings
            user={user}
            darkMode={darkMode}
            settings={settings}
            onToggleTheme={(isDark) => handleSettingsChange('theme', isDark ? 'dark' : 'light')}
            onChangeSetting={handleSettingsChange}
          />
        );

        case 'user-approval':
          if (loading) {
            return <div className="loading">Loading users...</div>;
          }
          if (error) {
            return <div className="error">Failed to load users: {error}</div>;
          }
          return (
            <>
              <div className="content-header">
                <h1>User Approval Management</h1>
                <p>Review and approve new user registrations</p>
              </div>
              <div className="approval-section">
                <div className="pending-users-section">
                  <h2>Pending User Registrations ({pendingUsers.length})</h2>
                  {pendingUsers.length === 0 ? (
                    <div className="no-pending-users">
                      <p>No pending user registrations</p>
                    </div>
                  ) : (
                    <div className="users-grid">
                      {pendingUsers.map(user => (
                        <div key={user._id} className="user-card">
                          <div className="user-header">
                            <div className="user-info">
                              <h3>{user.firstName} {user.lastName}</h3>
                              <p className="user-email">{user.email}</p>
                              <p className="user-id">ID: {user.userId}</p>
                              <p className="user-role">Role: <span className="role-badge">{user.role}</span></p>
                            </div>
                            <div className="user-status">
                              <span className="status-badge pending">Pending Approval</span>
                            </div>
                          </div>
                          
                          <div className="user-details">
                            <div className="detail-item">
                              <strong>Registration Date:</strong>
                              <span>{new Date(user.createdAt).toLocaleDateString()}</span>
                            </div>
                            <div className="detail-item">
                              <strong>Department:</strong>
                              <span>{user.department || 'Not specified'}</span>
                            </div>
                            <div className="detail-item">
                              <strong>Phone:</strong>
                              <span>{user.phone || 'Not provided'}</span>
                            </div>
                            {user.notes && (
                              <div className="detail-item">
                                <strong>Notes:</strong>
                                <span>{user.notes}</span>
                              </div>
                            )}
                          </div>
        
                          <div className="user-actions">
                            <button
                              onClick={() => handleUserApproval(user._id, 'approve')}
                              className={`approve-btn ${approvingUser === user._id ? 'loading' : ''}`}
                              disabled={approvingUser === user._id}
                            >
                              {approvingUser === user._id ? 'Approving...' : 'Approve'}
                            </button>
                            <button
                              onClick={() => {
                                const reason = prompt('Please provide a reason for rejection:');
                                if (reason && reason.trim()) {
                                  handleUserApproval(user._id, 'reject', reason.trim());
                                }
                              }}
                              className={`reject-btn ${approvingUser === user._id ? 'loading' : ''}`}
                              disabled={approvingUser === user._id}
                            >
                              {approvingUser === user._id ? 'Processing...' : 'Reject'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          );

      case 'templates':
        return (
          <ManagerTemplates onExportCsv={() => exportTemplates('csv')} onExportJson={() => exportTemplates('json')} onClose={() => setShowTemplateManager(false)} />
        );

      case 'password-reset':
        return (
          <ManagerPasswordReset />
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
      <ManagerSidebar
  activeTab={activeTab}
  onChangeTab={setActiveTab}
  sidebarCollapsed={sidebarCollapsed}
  onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
  onLogout={handleLogout}
/>
      {/* Main Content */}
      <div className={`main-content ${sidebarCollapsed ? 'expanded' : ''}`}>
        {renderContent()}
      </div>
     
       {/* Database Form Modal - Create New */}
{showDatabaseForm && (
  <div className="modal-overlay">
    <div className="modal">
      <div className="modal-header">
        <h2>Add New Database</h2>
        <button
          onClick={() => setShowDatabaseForm(false)}
          className="close-btn"
        >
          ×
        </button>
      </div>

      <form onSubmit={handleCreateDatabase} className="database-form">
        <div className="form-row">
          <div className="form-group">
            <label>Database Name</label>
            <input
              type="text"
              name="database"
              value={databaseFormData.database}
              onChange={handleInputChange}
              required
              placeholder="Enter database name"
            />
          </div>

          <div className="form-group">
            <label>Database Type</label>
            <input
              type="text"
              name="databaseType"
              value={databaseFormData.databaseType}
              onChange={handleInputChange}
              required
              placeholder="e.g., MySQL, PostgreSQL"
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>IP Address</label>
            <input
              type="text"
              name="ipAddress"
              value={databaseFormData.ipAddress}
              onChange={handleInputChange}
              required
              placeholder="e.g., 192.168.1.100"
            />
          </div>

          <div className="form-group">
            <label>DB Version</label>
            <input
              type="text"
              name="dbVersion"
              value={databaseFormData.dbVersion}
              onChange={handleInputChange}
              required
              placeholder="e.g., 8.0.33"
            />
          </div>
        </div>
        <div className="form-group">
          <label>OS Version</label>
          <input
            type="text"
            name="osVersion"
            value={databaseFormData.osVersion}
            onChange={handleInputChange}
            required
            placeholder="e.g., Ubuntu 20.04 LTS"
          />
        </div>
        {/* Custom Features Section */}
        <div className="form-group">
          <label>Custom Features</label>
          <div className="custom-features-section">
            <div className="add-custom-feature">
              <div className="form-row">
                <div className="form-group">
                  <input
                    type="text"
                    placeholder="Feature name"
                    value={newCustomFeature.name}
                    onChange={(e) => handleCustomFeatureChange('name', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <input
                    type="text"
                    placeholder="Feature label"
                    value={newCustomFeature.label}
                    onChange={(e) => handleCustomFeatureChange('label', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <select
                    value={newCustomFeature.type}
                    onChange={(e) => handleCustomFeatureChange('type', e.target.value)}
                  >
                    <option value="input">Text Input</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="enum">Yes/No</option>
                  </select>
                </div>
                <div className="form-group">
                  <input
                    type="text"
                    placeholder="Default value"
                    value={newCustomFeature.defaultValue}
                    onChange={(e) => handleCustomFeatureChange('defaultValue', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={newCustomFeature.required}
                      onChange={(e) => handleCustomFeatureChange('required', e.target.checked)}
                    />
                    Required
                  </label>
                </div>
                <button
                  type="button"
                  onClick={addCustomFeature}
                  className="add-feature-btn"
                >
                  Add Feature
                </button>
              </div>
            </div>
            {/* Display added custom features */}
            {customFeatures.length > 0 && (
              <div className="custom-features-list">
                <h4>Added Custom Features:</h4>
                {customFeatures.map((feature, index) => (
                  <div key={index} className="custom-feature-item">
                    <span className="feature-name">{feature.name}</span>
                    <span className="feature-label">({feature.label})</span>
                    <span className="feature-type">({feature.type})</span>
                    {feature.required && <span className="required-badge">Required</span>}
                    <button
                      type="button"
                      onClick={() => removeCustomFeature(index)}
                      className="remove-feature-btn"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="form-actions">
          <button 
            type="submit" 
            className={`submit-btn ${submitting ? 'btn-loading' : ''}`}
            disabled={submitting}
          >
            {submitting ? 'Creating...' : 'Create Database'}
          </button>
          <button 
            type="button" 
            onClick={() => setShowDatabaseForm(false)}
            className="cancel-btn"
            disabled={submitting}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  </div>
)}

{/* Edit Database Form Modal */}
{showEditDatabaseForm && editingDatabase && (
  <div className="modal-overlay">
    <div className="modal">
      <div className="modal-header">
        <h2>Edit Database</h2>
        <button
          onClick={() => {
            setShowEditDatabaseForm(false);
            setEditingDatabase(null);
          }}
          className="close-btn"
        >
          ×
        </button>
      </div>

      <form onSubmit={handleUpdateDatabase} className="database-form">
        <div className="form-row">
          <div className="form-group">
            <label>Database Name</label>
            <input
              type="text"
              name="database"
              value={databaseFormData.database}
              onChange={handleInputChange}
              required
              placeholder="Enter database name"
            />
          </div>

          <div className="form-group">
            <label>Database Type</label>
            <input
              type="text"
              name="databaseType"
              value={databaseFormData.databaseType}
              onChange={handleInputChange}
              required
              placeholder="e.g., MySQL, PostgreSQL"
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>IP Address</label>
            <input
              type="text"
              name="ipAddress"
              value={databaseFormData.ipAddress}
              onChange={handleInputChange}
              required
              placeholder="e.g., 192.168.1.100"
            />
          </div>

          <div className="form-group">
            <label>DB Version</label>
            <input
              type="text"
              name="dbVersion"
              value={databaseFormData.dbVersion}
              onChange={handleInputChange}
              required
              placeholder="e.g., 8.0.33"
            />
          </div>
        </div>
        <div className="form-group">
          <label>OS Version</label>
          <input
            type="text"
            name="osVersion"
            value={databaseFormData.osVersion}
            onChange={handleInputChange}
            required
            placeholder="e.g., Ubuntu 20.04 LTS"
          />
        </div>
        {/* Custom Features Section */}
        <div className="form-group">
          <label>Custom Features</label>
          <div className="custom-features-section">
            <div className="add-custom-feature">
              <div className="form-row">
                <div className="form-group">
                  <input
                    type="text"
                    placeholder="Feature name"
                    value={newCustomFeature.name}
                    onChange={(e) => handleCustomFeatureChange('name', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <input
                    type="text"
                    placeholder="Feature label"
                    value={newCustomFeature.label}
                    onChange={(e) => handleCustomFeatureChange('label', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <select
                    value={newCustomFeature.type}
                    onChange={(e) => handleCustomFeatureChange('type', e.target.value)}
                  >
                    <option value="input">Text Input</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="enum">Yes/No</option>
                  </select>
                </div>
                <div className="form-group">
                  <input
                    type="text"
                    placeholder="Default value"
                    value={newCustomFeature.defaultValue}
                    onChange={(e) => handleCustomFeatureChange('defaultValue', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={newCustomFeature.required}
                      onChange={(e) => handleCustomFeatureChange('required', e.target.checked)}
                    />
                    Required
                  </label>
                </div>
                <button
                  type="button"
                  onClick={addCustomFeature}
                  className="add-feature-btn"
                >
                  Add Feature
                </button>
              </div>
            </div>
            {/* Display added custom features */}
            {customFeatures.length > 0 && (
              <div className="custom-features-list">
                <h4>Added Custom Features:</h4>
                {customFeatures.map((feature, index) => (
                  <div key={index} className="custom-feature-item">
                    <span className="feature-name">{feature.name}</span>
                    <span className="feature-label">({feature.label})</span>
                    <span className="feature-type">({feature.type})</span>
                    {feature.required && <span className="required-badge">Required</span>}
                    <button
                      type="button"
                      onClick={() => removeCustomFeature(index)}
                      className="remove-feature-btn"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="form-actions">
          <button 
            type="submit" 
            className={`submit-btn ${submitting ? 'btn-loading' : ''}`}
            disabled={submitting}
          >
            {submitting ? 'Updating...' : 'Update Database'}
          </button>
          <button 
            type="button" 
            onClick={() => {
              setShowEditDatabaseForm(false);
              setEditingDatabase(null);
            }}
            className="cancel-btn"
            disabled={submitting}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  </div>
)}

      {/* File Preview Modal */}
      {showPreview && (
        <FilePreview
          file={previewFile}
          filename={previewFilename}
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* Keyboard Shortcuts */}
      <KeyboardShortcuts
        onNewDatabase={() => setShowDatabaseForm(true)}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        onRefresh={() => {
          fetchReports();
          fetchDatabases();
        }}
        onExport={() => {
          // Export functionality can be added here
          window.showToast('Export functionality coming soon!', 'info');
        }}
        onSearch={() => {
          // Search functionality can be added here
          window.showToast('Search functionality coming soon!', 'info');
        }}
        userRole="manager"
      />
    </div>
  );
};

export default ManagerDashboard;
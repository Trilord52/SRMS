import React, { useEffect, useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';
import './ManagerAnalytics.css';

const COLORS = ['#00C49F', '#FFBB28', '#FF8042', '#0088FE', '#AA66CC'];

const ManagerAnalytics = ({ period = 'weekly', staffId = '', staffOptions = [], onLoadingChange }) => {
  const [selectedPeriod, setSelectedPeriod] = useState(period);
  const [selectedStaffId, setSelectedStaffId] = useState(staffId);
  const [analytics, setAnalytics] = useState(null);
  const [staffPerformance, setStaffPerformance] = useState([]);
  const [databasePerformance, setDatabasePerformance] = useState([]);
  const [drilldown, setDrilldown] = useState([]);
  const [loading, setLoading] = useState(true);

  const hasStaffOptions = Array.isArray(staffOptions) && staffOptions.length > 0;

  useEffect(() => {
    setSelectedPeriod(period);
  }, [period]);

  useEffect(() => {
    setSelectedStaffId(staffId);
  }, [staffId]);

  const staffSelectOptions = useMemo(() => {
    return [{ _id: '', firstName: 'All', lastName: 'Staff' }, ...staffOptions];
  }, [staffOptions]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        onLoadingChange && onLoadingChange(true);
        const token = localStorage.getItem('token');

        const dashUrl = `http://localhost:5000/analytics/dashboard?period=${encodeURIComponent(selectedPeriod)}${selectedStaffId ? `&staffId=${encodeURIComponent(selectedStaffId)}` : ''}`;
        const dashRes = await fetch(dashUrl, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!dashRes.ok) throw new Error('Failed to fetch dashboard data');
        const dashboard = await dashRes.json();
        setAnalytics(dashboard.analytics);
        setStaffPerformance(dashboard.staffPerformance || []);
        setDatabasePerformance(dashboard.databasePerformance || []);

        if (selectedStaffId) {
          const drillUrl = `http://localhost:5000/analytics/staff-performance?period=${encodeURIComponent(selectedPeriod)}&staffId=${encodeURIComponent(selectedStaffId)}`;
          const drillRes = await fetch(drillUrl, { headers: { 'Authorization': `Bearer ${token}` } });
          if (drillRes.ok) {
            const drill = await drillRes.json();
            setDrilldown(Array.isArray(drill) ? drill : []);
          }
        } else {
          setDrilldown([]);
        }
      } catch (e) {
        console.error('Analytics fetch error', e);
        setAnalytics({
          totalReports: 0,
          completedReports: 0,
          pendingReports: 0,
          reviewStats: { pending: 0, approved: 0, rejected: 0 },
          performanceMetrics: {
            completionRate: 0,
            submissionTrend: []
          }
        });
        setStaffPerformance([]);
        setDatabasePerformance([]);
        setDrilldown([]);
      } finally {
        setLoading(false);
        onLoadingChange && onLoadingChange(false);
      }
    };
    fetchData();
  }, [selectedPeriod, selectedStaffId, onLoadingChange]);

  if (loading) return <div className="loading">Loading analytics...</div>;
  if (!analytics) return <div className="error">No analytics data available</div>;

  const kpiCards = [
    { label: 'Total Reports', value: analytics.totalReports || 0 },
    { label: 'Completed Reports', value: analytics.completedReports || 0 },
    { label: 'Pending Reports', value: analytics.pendingReports || 0 },
    { label: 'Completion Rate', value: `${analytics.performanceMetrics?.completionRate || 0}%` },
  ];

  const reviewData = [
    { name: 'Pending', value: analytics.reviewStats?.pending || 0, color: '#FFBB28' },
    { name: 'Approved', value: analytics.reviewStats?.approved || 0, color: '#00C49F' },
    { name: 'Rejected', value: analytics.reviewStats?.rejected || 0, color: '#FF8042' },
  ];

  const trend = Array.isArray(analytics.performanceMetrics?.submissionTrend)
    ? analytics.performanceMetrics.submissionTrend
    : [];

  const topStaff = (staffPerformance || []).slice(0, 10).map(s => ({
    name: `${s.staff?.firstName || ''} ${s.staff?.lastName || ''}`.trim() || s.staff?.email || 'Unknown',
    performance: Number(s.performance || s.performanceScore || 0),
    reports: Number(s.reportsCount || s.totalReports || 0),
  }));

  // Top Templates Over Time (approximate using trend + total reports per period)
  // Since backend doesn’t return per-template trend, we keep submission trend; optional extension later

  // Approvals by Template (using databasePerformance with reviewStats)
  const approvalsByTemplate = (databasePerformance || []).map(d => ({
    name: d.database || 'Unknown',
    approved: Number(d.reviewStats?.approved || 0),
  })).filter(d => d.approved > 0);

  // Approvals by Template Category (no direct category; using template name proxy). Future: add category aggregation endpoint.
  const approvalsByTemplatePie = approvalsByTemplate.map((d, idx) => ({ name: d.name, value: d.approved, color: COLORS[idx % COLORS.length] }));

  // Average Supervisor Response Time by Template (hours)
  const responseByTemplate = (databasePerformance || []).map(d => ({ name: d.database || 'Unknown', hours: Number(d.averageResponseTime || 0) }));

  return (
    <div className="analytics-dashboard">
      <div className="analytics-controls">
        <div className="control-group">
          <label>Period</label>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="analytics-select"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="annually">Annually</option>
          </select>
        </div>
        <div className="control-group">
          <label>Staff</label>
          <select
            value={selectedStaffId}
            onChange={(e) => setSelectedStaffId(e.target.value)}
            className="analytics-select"
            disabled={!hasStaffOptions}
          >
            {staffSelectOptions.map(s => (
              <option key={s._id || 'all'} value={s._id || ''}>
                {s.firstName} {s.lastName}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="kpi-grid">
        {kpiCards.map((k, idx) => (
          <div key={idx} className="kpi-card">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3>Review Status</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={reviewData} dataKey="value" nameKey="name" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                {reviewData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value, name) => [value, name]} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Submission Trend</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={trend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis allowDecimals={false} />
              <Tooltip formatter={(value) => [value, 'Reports']} />
              <Line type="monotone" dataKey="count" stroke="#0088FE" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3>Approvals by Template</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={approvalsByTemplate} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" interval={0} angle={-30} textAnchor="end" height={60} fontSize={12} />
              <YAxis />
              <Tooltip formatter={(value) => [value, 'Approved']} labelFormatter={(label) => `Template: ${label}`} />
              <Bar dataKey="approved" fill="#00C49F" name="Approved" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Approvals by Template (Pie)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={approvalsByTemplatePie} dataKey="value" nameKey="name" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                {approvalsByTemplatePie.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value, name) => [value, name]} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3>Avg Supervisor Response Time by Template (hrs)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={responseByTemplate} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" interval={0} angle={-30} textAnchor="end" height={60} fontSize={12} />
              <YAxis />
              <Tooltip formatter={(value) => [value, 'Hours']} labelFormatter={(label) => `Template: ${label}`} />
              <Bar dataKey="hours" fill="#FF8042" name="Avg Hours" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {selectedStaffId && drilldown.length > 0 && (
        <div className="charts-grid">
          <div className="chart-card">
            <h3>Staff Performance Details</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={drilldown.map(d => ({ name: d.label || d.metric || 'Metric', value: Number(d.value || 0) }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" interval={0} angle={-30} textAnchor="end" height={60} />
                <YAxis />
                <Tooltip formatter={(value) => [value, 'Value']} />
                <Bar dataKey="value" fill="#FF8042" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="data-summary">
        <h3>Data Summary</h3>
        <div className="summary-grid">
          <div className="summary-item"><strong>Total Reports:</strong> {analytics.totalReports || 0}</div>
          <div className="summary-item"><strong>Approved:</strong> {analytics.reviewStats?.approved || 0}</div>
          <div className="summary-item"><strong>Pending:</strong> {analytics.reviewStats?.pending || 0}</div>
          <div className="summary-item"><strong>Rejected:</strong> {analytics.reviewStats?.rejected || 0}</div>
        </div>
      </div>
    </div>
  );
};

export default ManagerAnalytics;
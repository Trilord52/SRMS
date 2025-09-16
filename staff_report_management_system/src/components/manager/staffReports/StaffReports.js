import React from 'react';
import ReportCard from '../../shared/ReportCard';

const StaffReports = ({ reports, onPreviewFile, onDownloadFile, exportReports, templateSearch, setTemplateSearch, userSearch, setUserSearch }) => {
  const approved = (Array.isArray(reports) ? reports : []).filter(r => r.reviewStatus === 'approved');
  const filtered = approved.filter(r => {
    const tQuery = (templateSearch || '').trim().toLowerCase();
    const uQuery = (userSearch || '').trim().toLowerCase();
    const templateName = (r.templateId?.name || '').toLowerCase();
    const userName = `${r.submittedBy?.firstName || ''} ${r.submittedBy?.lastName || ''}`.trim().toLowerCase();
    const userEmail = (r.submittedBy?.email || '').toLowerCase();
    const tOk = tQuery ? templateName.includes(tQuery) : true;
    const uOk = uQuery ? (userName.includes(uQuery) || userEmail.includes(uQuery)) : true;
    return tOk && uOk;
  });

  return (
    <>
      <div className="content-header">
        <h1>Staff Reports</h1>
        <p>Approved reports across all staff and supervisors</p>
      </div>

      <div className="filters-section" style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'center' }}>
        <input type="text" placeholder="Search by template name..." value={templateSearch} onChange={(e) => setTemplateSearch(e.target.value)} className="filter-input" style={{ flex: '1 1 280px' }} />
        <input type="text" placeholder="Search by user name or email..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} className="filter-input" style={{ flex: '1 1 280px' }} />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <button className="bulk-export-btn" onClick={() => exportReports('csv')}>Export Reports (CSV)</button>
          <button className="bulk-export-btn" onClick={() => exportReports('excel')}>Export Reports (JSON)</button>
        </div>
      </div>

      <div className="reports-section">
        <h2>Approved Reports</h2>
        {filtered.length === 0 ? (
          <p className="no-reports">No approved reports found.</p>
        ) : (
          <div className="reports-grid">
            {filtered.map(report => (
              <ReportCard
                key={report._id}
                report={report}
                isSelected={false}
                onToggleSelect={() => {}}
                onPreviewFile={onPreviewFile}
                onDownloadFile={onDownloadFile}
                hasRevision={approved.some(r => r.revisionOf === report._id)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default StaffReports; 
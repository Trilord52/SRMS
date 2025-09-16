import React from 'react';

const ReportCard = ({
  report,
  isSelected,
  onToggleSelect,
  onPreviewFile,
  onDownloadFile,
  showSupervisorComments = false,
  onEdit,
  hasRevision = false
}) => {
  const renderStatus = () => {
    const status = report.reviewStatus || 'pending';
    if (status === 'approved') {
      return <span className="status-pill status-approved">✔ Approved</span>;
    }
    if (status === 'rejected') {
      return <span className="status-pill status-rejected">✖ Rejected</span>;
    }
    return <span className="status-pill status-pending">⏳ Pending (Supervisor)</span>;
  };

  const title = report.templateId?.name || report.database || 'Template Report';

  return (
    <div className="report-card">
      <div className="report-checkbox">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
        />
      </div>
      <div className="report-header">
        <h3>
          {title}
          {hasRevision && <span style={{ marginLeft: 8 }} className="revision-badge">Has revision</span>}
        </h3>
        <div className="report-meta">
          <span className="report-date">
            {new Date(report.submissionDate).toLocaleDateString()}
          </span>
          <span className="report-week">
            Week {report.weekNumber}, {report.year}
          </span>
          {renderStatus()}
        </div>
      </div>
      <div className="report-details">
        <p><strong>Submitted by:</strong> {report.submittedBy?.firstName} {report.submittedBy?.lastName}</p>
        {report.rejectionReason && (
          <p><strong>Rejection Reason:</strong> {report.rejectionReason}</p>
        )}
      </div>

      {showSupervisorComments && report.supervisorComments && (
        <div className="report-section">
          <h4>Supervisor Comments</h4>
          <p className="supervisor-comments">{report.supervisorComments}</p>
        </div>
      )}

      {report.files && report.files.length > 0 && (
        <div className="report-section">
          <h4>Attachments</h4>
          <div className="file-list">
            {report.files.map((file, index) => (
              <div key={index} className="file-item">
                <span className="file-name">
                  {typeof file === 'string' ? file : file.name || 'Unknown file'}
                </span>
                <div className="file-actions">
                  <button onClick={() => onPreviewFile(file)} className="preview-btn">👁️ Preview</button>
                  <button onClick={() => onDownloadFile(typeof file === 'string' ? file : file.name)} className="download-btn">📥 Download</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {onEdit && report.reviewStatus === 'rejected' && !hasRevision && (
        <div className="report-actions">
          <button onClick={onEdit} className="review-btn">Edit and Resubmit</button>
        </div>
      )}
    </div>
  );
};

export default ReportCard; 
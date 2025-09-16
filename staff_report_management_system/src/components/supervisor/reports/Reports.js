import React from 'react';

const Reports = ({
  reports,
  sortBy,
  sortOrder,
  onSortChange,
  onToggleSortOrder,
  weekOptions = [],
  selectedWeek = '',
  onWeekChange,
  yearOptions = [],
  selectedYear,
  onYearChange,
  selectedStatus = '',
  onStatusChange,
  dateRange = { startDate: '', endDate: '' },
  onDateStartChange,
  onDateEndChange,
  onClearFilters,
  openViewReport,
  handleReviewReport,
  totalPages = 1,
  currentPage = 1,
  onPageChange,
  totalCount = 0,
  FiltersToolbar,
}) => {
  return (
    <>
      <div className="content-header">
        <h1>All Reports</h1>
        <p>Review and manage all submitted reports</p>
      </div>

      {FiltersToolbar && (
        <FiltersToolbar
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={onSortChange}
          onToggleSortOrder={onToggleSortOrder}
          weekOptions={weekOptions}
          selectedWeek={selectedWeek}
          onWeekChange={onWeekChange}
          yearOptions={yearOptions}
          selectedYear={selectedYear}
          onYearChange={onYearChange}
          selectedStatus={selectedStatus}
          onStatusChange={onStatusChange}
          dateRange={dateRange}
          onDateStartChange={onDateStartChange}
          onDateEndChange={onDateEndChange}
          onClearFilters={onClearFilters}
        />
      )}

      <div className="reports-section">
        <h2>Report History</h2>
        {(Array.isArray(reports) ? reports : []).length === 0 ? (
          <p className="no-reports">No reports found.</p>
        ) : (
          <>
            <div className="reports-grid">
              {(Array.isArray(reports) ? reports : []).map(report => (
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
                    {report.rejectionReason && (
                      <p><strong>Rejection:</strong> {report.rejectionReason}</p>
                    )}
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

            {totalPages > 1 && (
              <div className="pagination">
                <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="pagination-btn">Previous</button>
                <span className="pagination-info">Page {currentPage} of {totalPages} ({totalCount} total reports)</span>
                <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="pagination-btn">Next</button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default Reports; 
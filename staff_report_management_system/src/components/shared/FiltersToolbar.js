import React from 'react';

const FiltersToolbar = ({
  sortBy,
  sortOrder,
  onSortChange,
  onToggleSortOrder,
  weekOptions = [],
  selectedWeek,
  onWeekChange,
  yearOptions = [],
  selectedYear,
  onYearChange,
  databases = [],
  selectedDatabase = '',
  onDatabaseChange = () => {},
  selectedStatus,
  onStatusChange,
  dateRange = { startDate: '', endDate: '' },
  onDateStartChange,
  onDateEndChange,
  onClearFilters
}) => {
  return (
    <div className="filters-section">
      <div className="filter-row">
        <div className="filter-group">
          <label>Sort By:</label>
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            className="filter-select"
          >
            <option value="submissionDate">Submission Date</option>
            <option value="weekNumber">Week</option>
            <option value="year">Year</option>
          </select>
          <button
            onClick={onToggleSortOrder}
            className="sort-btn"
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
        <div className="filter-group">
          <label>Week:</label>
          <select
            value={selectedWeek}
            onChange={(e) => onWeekChange(e.target.value)}
            className="filter-select"
          >
            <option value="">All Weeks</option>
            {weekOptions.map(week => (
              <option key={week} value={week}>
                Week {week}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>Year:</label>
          <select
            value={selectedYear}
            onChange={(e) => onYearChange(e.target.value)}
            className="filter-select"
          >
            {yearOptions.map(year => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
        {Array.isArray(databases) && databases.length > 0 && (
          <div className="filter-group">
            <label>Database:</label>
            <select
              value={selectedDatabase}
              onChange={(e) => onDatabaseChange(e.target.value)}
              className="filter-select"
            >
              <option value="">All Databases</option>
              {databases.map(db => (
                <option key={db._id} value={db.database}>
                  {db.database}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="filter-group">
          <label>Status:</label>
          <select
            value={selectedStatus}
            onChange={(e) => onStatusChange(e.target.value)}
            className="filter-select"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>
      <div className="filter-row">
        <div className="filter-group">
          <label>Date Range:</label>
          <input
            type="date"
            value={dateRange.startDate}
            onChange={(e) => onDateStartChange(e.target.value)}
            className="filter-input"
          />
          <span>to</span>
          <input
            type="date"
            value={dateRange.endDate}
            onChange={(e) => onDateEndChange(e.target.value)}
            className="filter-input"
          />
        </div>
        <button
          onClick={onClearFilters}
          className="clear-filters-btn"
        >
          Clear Filters
        </button>
      </div>
    </div>
  );
};

export default FiltersToolbar; 
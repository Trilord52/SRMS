import React from 'react';

const StaffPagination = ({ currentPage, totalPages, totalCount, onPrev, onNext }) => {
  if (totalPages <= 1) return null;

  return (
    <div className="pagination">
      <button
        onClick={onPrev}
        disabled={currentPage === 1}
        className="pagination-btn"
      >
        Previous
      </button>
      <span className="pagination-info">
        Page {currentPage} of {totalPages} ({totalCount} total reports)
      </span>
      <button
        onClick={onNext}
        disabled={currentPage === totalPages}
        className="pagination-btn"
      >
        Next
      </button>
    </div>
  );
};

export default StaffPagination; 
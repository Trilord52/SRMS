import React, { useEffect, useCallback } from 'react';
import '../KeyboardShortcuts.css';

const KeyboardShortcuts = ({ 
  onNewReport, 
  onNewDatabase, 
  onToggleDarkMode, 
  onToggleSidebar, 
  onRefresh, 
  onExport,
  onSearch,
  userRole 
}) => {
  const handleKeyDown = useCallback((event) => {
    if (event.target.tagName === 'INPUT' || 
        event.target.tagName === 'TEXTAREA' || 
        event.target.tagName === 'SELECT' ||
        event.target.contentEditable === 'true') {
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
      event.preventDefault();
      if (userRole === 'staff' && onNewReport) {
        onNewReport();
      } else if (userRole === 'manager' && onNewDatabase) {
        onNewDatabase();
      }
    }

    if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
      event.preventDefault();
      if (onToggleDarkMode) onToggleDarkMode();
    }

    if ((event.ctrlKey || event.metaKey) && event.key === 'b') {
      event.preventDefault();
      if (onToggleSidebar) onToggleSidebar();
    }

    if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
      event.preventDefault();
      if (onRefresh) onRefresh();
    }

    if ((event.ctrlKey || event.metaKey) && event.key === 'e') {
      event.preventDefault();
      if (onExport) onExport();
    }

    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
      event.preventDefault();
      if (onSearch) onSearch();
    }

    if (event.key === 'Escape') {
      window.dispatchEvent(new CustomEvent('escapePressed'));
    }

    if (event.key === 'F1') {
      event.preventDefault();
      const shortcuts = [
        { key: 'Ctrl/Cmd + N', action: userRole === 'staff' ? 'New Report' : 'New Database' },
        { key: 'Ctrl/Cmd + D', action: 'Toggle Dark Mode' },
        { key: 'Ctrl/Cmd + B', action: 'Toggle Sidebar' },
        { key: 'Ctrl/Cmd + R', action: 'Refresh Data' },
        { key: 'Ctrl/Cmd + E', action: 'Export Data' },
        { key: 'Ctrl/Cmd + K', action: 'Search' },
        { key: 'Escape', action: 'Close Forms/Modals' },
        { key: 'F1', action: 'Show This Help' }
      ];
      const helpMessage = shortcuts.map(s => `${s.key}: ${s.action}`).join('\n');
      window.showToast(`Keyboard Shortcuts:\n${helpMessage}`, 'info', 5000);
    }
  }, [onNewReport, onNewDatabase, onToggleDarkMode, onToggleSidebar, onRefresh, onExport, onSearch, userRole]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return null;
};

export default KeyboardShortcuts; 
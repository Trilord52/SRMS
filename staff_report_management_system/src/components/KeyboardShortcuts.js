import React, { useEffect, useCallback } from 'react';
import './KeyboardShortcuts.css';

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
    // Don't trigger shortcuts when typing in input fields
    if (event.target.tagName === 'INPUT' || 
        event.target.tagName === 'TEXTAREA' || 
        event.target.tagName === 'SELECT' ||
        event.target.contentEditable === 'true') {
      return;
    }

    // Ctrl/Cmd + N: New Report/Database
    if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
      event.preventDefault();
      if (userRole === 'staff' && onNewReport) {
        onNewReport();
      } else if (userRole === 'manager' && onNewDatabase) {
        onNewDatabase();
      }
    }

    // Ctrl/Cmd + D: Toggle Dark Mode
    if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
      event.preventDefault();
      if (onToggleDarkMode) {
        onToggleDarkMode();
      }
    }

    // Ctrl/Cmd + B: Toggle Sidebar
    if ((event.ctrlKey || event.metaKey) && event.key === 'b') {
      event.preventDefault();
      if (onToggleSidebar) {
        onToggleSidebar();
      }
    }

    // Ctrl/Cmd + R: Refresh
    if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
      event.preventDefault();
      if (onRefresh) {
        onRefresh();
      }
    }

    // Ctrl/Cmd + E: Export
    if ((event.ctrlKey || event.metaKey) && event.key === 'e') {
      event.preventDefault();
      if (onExport) {
        onExport();
      }
    }

    // Ctrl/Cmd + K: Search
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
      event.preventDefault();
      if (onSearch) {
        onSearch();
      }
    }

    // Escape: Close forms/modals
    if (event.key === 'Escape') {
      // This will be handled by individual components
      // We can emit a custom event for them to listen to
      window.dispatchEvent(new CustomEvent('escapePressed'));
    }

    // F1: Show help
    if (event.key === 'F1') {
      event.preventDefault();
      showKeyboardShortcutsHelp();
    }
  }, [onNewReport, onNewDatabase, onToggleDarkMode, onToggleSidebar, onRefresh, onExport, onSearch, userRole]);

  const showKeyboardShortcutsHelp = () => {
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
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // This component doesn't render anything visible
  return null;
};

export default KeyboardShortcuts;

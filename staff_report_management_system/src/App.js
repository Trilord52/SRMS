import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './components/Login';
import Signup from './components/Signup';
import StaffDashboard from './components/StaffDashboard';
import SupervisorDashboard from './components/SupervisorDashboard';
import ManagerDashboard from './components/ManagerDashboard';
import ToastContainer from './components/ToastContainer';

function App() {
  return (
    <div>
      <ToastContainer />
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/staff-dashboard" element={<StaffDashboard />} />
          <Route path="/supervisor-dashboard" element={<SupervisorDashboard />} />
          <Route path="/manager-dashboard" element={<ManagerDashboard />} />
          <Route path="/" element={<Login />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
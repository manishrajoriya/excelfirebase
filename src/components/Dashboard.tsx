import type { FC } from 'react';
import UserForm from './UserForm';
import UserProfile from './UserProfile';
import './Dashboard.css';

const Dashboard: FC = () => {
  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      <div className="dashboard-content">
        <div className="card">
          <h3>Welcome to ExcelFirebase</h3>
          <p>Your Excel files are ready to be managed.</p>
        </div>
        
        <div className="stats-grid">
          <div className="stat-card">
            <h4>Total Files</h4>
            <p className="stat-number">0</p>
          </div>
          <div className="stat-card">
            <h4>Recent Activity</h4>
            <p className="stat-number">0</p>
          </div>
          <div className="stat-card">
            <h4>Storage Used</h4>
            <p className="stat-number">0 MB</p>
          </div>
        </div>

        <div className="user-data-section">
          <UserProfile />
          <UserForm />
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 
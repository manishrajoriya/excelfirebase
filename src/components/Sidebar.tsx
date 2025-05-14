import type { FC } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Sidebar.css';

interface SidebarProps {
  userEmail: string | null;
  onSignOut: () => void;
}

const Sidebar: FC<SidebarProps> = ({ userEmail, onSignOut }) => {
  const location = useLocation();

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h3>ExcelFirebase</h3>
        <p className="user-email">{userEmail}</p>
      </div>
      
      <nav className="sidebar-nav">
        <ul>
          <li>
            <Link 
              to="/dashboard"
              className={location.pathname === '/dashboard' ? 'active' : ''}
            >
              <span className="icon">📊</span>
              Dashboard
            </Link>
          </li>
          <li>
            <Link 
              to="/U"
              className={location.pathname === '/profile' ? 'active' : ''}
            >
              <span className="icon">👤</span>
              Profile
            </Link>
          </li>
          <li>
            <Link 
              to="/files"
              className={location.pathname === '/files' ? 'active' : ''}
            >
              <span className="icon">📁</span>
              Files
            </Link>
          </li>
          <li>
            <Link 
              to="/settings"
              className={location.pathname === '/settings' ? 'active' : ''}
            >
              <span className="icon">⚙️</span>
              Settings
            </Link>
          </li>
        </ul>
      </nav>

      <div className="sidebar-footer">
        <button onClick={onSignOut} className="sign-out-btn">
          <span className="icon">🚪</span>
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default Sidebar; 
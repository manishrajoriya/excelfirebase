import { FC } from 'react';
import './Sidebar.css';

interface SidebarProps {
  userEmail: string | null;
  onSignOut: () => void;
}

const Sidebar: FC<SidebarProps> = ({ userEmail, onSignOut }) => {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h3>ExcelFirebase</h3>
        <p className="user-email">{userEmail}</p>
      </div>
      
      <nav className="sidebar-nav">
        <ul>
          <li>
            <a href="#" className="active">
              <span className="icon">📊</span>
              Dashboard
            </a>
          </li>
          <li>
            <a href="#">
              <span className="icon">📁</span>
              Files
            </a>
          </li>
          <li>
            <a href="#">
              <span className="icon">⚙️</span>
              Settings
            </a>
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
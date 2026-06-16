import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const Sidebar = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">Harmonix</div>
      <ul>
        <li>
          <Link to="/">Home</Link>
        </li>
        <li>
          <Link to="/search">Search</Link>
        </li>
        <li>
          <Link to="/library">Library</Link>
        </li>
      </ul>
      <div className="sidebar-footer">
        <span>{user?.username || 'Signed in'}</span>
        <button type="button" onClick={handleLogout}>Logout</button>
      </div>
    </aside>
  );
};

export default Sidebar;

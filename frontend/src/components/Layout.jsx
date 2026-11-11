import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { CalendarDays, FileText, LayoutDashboard, LogOut, Menu, PawPrint, UserRound, Users } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { fileUrl } from '../api';
import { Avatar } from './ui';

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/patients', label: 'Patients', icon: Users },
  { to: '/appointments', label: 'Appointments', icon: CalendarDays },
  { to: '/prescriptions', label: 'Prescriptions', icon: FileText },
  { to: '/profile', label: 'Profile', icon: UserRound },
];

export default function Layout() {
  const { doctor, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const onLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="app">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <PawPrint size={26} />
          <span>Doctor Management<br />System</span>
        </div>
        <nav>
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={() => setOpen(false)}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Icon size={18} /> {label}
            </NavLink>
          ))}
          <button className="nav-link nav-btn" onClick={onLogout}><LogOut size={18} /> Logout</button>
        </nav>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="Menu"><Menu size={22} /></button>
          <div className="topbar-user" onClick={() => navigate('/profile')}>
            <span>Welcome, {doctor?.full_name?.startsWith('Dr') ? doctor.full_name : `Dr. ${doctor?.full_name}`}</span>
            <Avatar src={fileUrl(doctor?.profile_image)} name={doctor?.full_name} size={34} />
          </div>
        </header>
        <main className="page"><Outlet /></main>
      </div>
    </div>
  );
}

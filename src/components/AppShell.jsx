import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { selectUser, logout } from '@/features/auth/authSlice';
import BrandMark from './BrandMark';

const NAV_ITEMS = [
  { to: '/projects', label: 'Projects', icon: 'M3 7h7l2 2h9v10H3z' },
  { to: '/community', label: 'Community Circuits', icon: 'M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5c-.8 0-1.5-.7-1.5-1.5zM13 4h5.5c.8 0 1.5.7 1.5 1.5v13c0 .8-.7 1.5-1.5 1.5H13z' },
  {
    to: '/settings',
    label: 'Settings',
    icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 14H4a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 9 4.6V4.5a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  },
];

function NavIcon({ d }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export default function AppShell({ title, children }) {
  const user = useSelector(selectUser);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const initial = (user?.name || '?').trim().charAt(0).toUpperCase();
  const items = user ? NAV_ITEMS : NAV_ITEMS.filter((item) => item.to !== '/projects' && item.to !== '/settings');

  return (
    <div className="app">
      <aside className="side">
        <Link to="/" className="brand">
          <BrandMark size={26} />
          Techomato Labs
        </Link>
        <nav className="side-nav">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `side-link${isActive ? ' on' : ''}`}
            >
              <NavIcon d={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          {user ? (
            <>
              <div className="side-link" style={{ cursor: 'default' }}>
                <span className="avatar" style={{ width: 26, height: 26, fontSize: 14 }}>
                  {user.avatar || initial}
                </span>
                {user.name}
              </div>
              <button
                className="side-link"
                onClick={async () => {
                  await dispatch(logout());
                  navigate('/');
                }}
              >
                <NavIcon d="M15 4h4v16h-4M10 17l5-5-5-5M15 12H3" />
                Log out
              </button>
            </>
          ) : (
            <>
              <Link className="side-link" to="/login">
                Log in
              </Link>
              <Link className="side-link" to="/signup">
                Sign up
              </Link>
            </>
          )}
        </div>
      </aside>
      <div className="main">
        <div className="topbar">
          <h1 className="page-h">{title}</h1>
        </div>
        {children}
      </div>
      <nav className="tabbar" aria-label="App">
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'on' : '')}>
            <NavIcon d={item.icon} />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

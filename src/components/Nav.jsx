import { useState, useRef, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { selectUser } from '@/features/auth/authSlice';
import { logout } from '@/features/auth/authSlice';
import BrandMark from './BrandMark';

export default function Nav({ active }) {
  const user = useSelector(selectUser);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [menuOpen]);

  const initial = (user?.name || '?').trim().charAt(0).toUpperCase();

  return (
    <header className="nav">
      <div className="container nav-in">
        <Link to="/" className="brand">
          <BrandMark />
          <b>Techomato Labs</b>
        </Link>
        <nav className="nav-links">
          {user && (
            <NavLink to="/projects" className={active === 'projects' ? 'on' : ''}>
              Projects
            </NavLink>
          )}
          <NavLink to="/community" className={active === 'gallery' ? 'on' : ''}>
            Community Circuits
          </NavLink>
          <NavLink to="/lessons" className={active === 'lessons' ? 'on' : ''}>
            Lessons
          </NavLink>
          <NavLink to="/discussions" className={active === 'discussions' ? 'on' : ''}>
            Discussions
          </NavLink>
        </nav>
        <div className="nav-right">
          {user ? (
            <div style={{ position: 'relative' }} ref={menuRef}>
              <button
                className="avatar"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Account menu"
                aria-expanded={menuOpen}
              >
                {user.avatar || initial}
              </button>
              {menuOpen && (
                <div className="menu glass" role="menu">
                  <div className="menu-head">
                    {user.name}
                    <span>{user.email}</span>
                  </div>
                  <Link to="/projects" onClick={() => setMenuOpen(false)}>
                    Your projects
                  </Link>
                  <Link to="/notifications" onClick={() => setMenuOpen(false)}>
                    Notifications
                  </Link>
                  <Link to="/saved" onClick={() => setMenuOpen(false)}>
                    Saved circuits
                  </Link>
                  <Link to="/settings" onClick={() => setMenuOpen(false)}>
                    Settings
                  </Link>
                  <button
                    onClick={async () => {
                      setMenuOpen(false);
                      await dispatch(logout());
                      navigate('/');
                    }}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link to="/login" className="btn hide-sm">
                Log in
              </Link>
              <Link to="/signup" className="btn primary">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectIsAdmin } from './adminSlice';

/** Redirects anyone without an admin session to /admin/login. Entirely
 * separate from RequireAuth — a signed-in regular user is not an admin. */
export default function RequireAdmin({ children }) {
  const isAdmin = useSelector(selectIsAdmin);
  if (!isAdmin) return <Navigate to="/admin/login" replace />;
  return children;
}

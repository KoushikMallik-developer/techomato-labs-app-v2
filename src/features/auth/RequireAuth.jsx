import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectIsSignedIn } from './authSlice';

/** Redirects signed-out visitors to /login?next=<attempted path>. */
export default function RequireAuth({ children }) {
  const isSignedIn = useSelector(selectIsSignedIn);
  const location = useLocation();
  if (!isSignedIn) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return children;
}

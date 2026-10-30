import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectIsSignedIn } from './authSlice';

/** Redirects already-signed-in visitors away from /login and /signup. */
export default function RequireGuest({ children }) {
  const isSignedIn = useSelector(selectIsSignedIn);
  if (isSignedIn) return <Navigate to="/projects" replace />;
  return children;
}

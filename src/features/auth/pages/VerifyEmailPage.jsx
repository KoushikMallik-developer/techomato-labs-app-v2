import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import AuthCard from '../components/AuthCard';
import { selectUser, selectIsSignedIn, verifyEmail, resendVerification } from '../authSlice';
import { sanitizeNext } from '@/lib/url';

/** Not behind RequireAuth: the link in the verification email works from any
 * browser/session (Firebase checks the code, not the session), and a
 * signed-out visitor who clicks it should still get verified. */
export default function VerifyEmailPage() {
  const user = useSelector(selectUser);
  const isSignedIn = useSelector(selectIsSignedIn);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = sanitizeNext(params.get('next'));
  // Firebase's email links carry `oobCode`.
  const token = params.get('oobCode') || params.get('token');

  const [state, setState] = useState(token ? 'checking' : 'idle');
  const [error, setError] = useState(null);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (!token) return;
    dispatch(verifyEmail(token)).then((res) => {
      if (verifyEmail.fulfilled.match(res)) setState('verified');
      else {
        setState('failed');
        setError(res.error?.message || 'That verification link is invalid or already used.');
      }
    });
  }, [dispatch, token]);

  async function onResend() {
    const res = await dispatch(resendVerification());
    if (resendVerification.fulfilled.match(res)) setResent(true);
  }

  if (state === 'checking') {
    return (
      <AuthCard title="Verifying your email…" subtitle="Just a moment.">
        <span className="spin" aria-hidden="true" />
      </AuthCard>
    );
  }

  if (state === 'verified' || user?.verified) {
    return (
      <AuthCard title="Email verified" subtitle="You're all set.">
        <button className="btn primary block" onClick={() => navigate(isSignedIn ? next : '/login')}>
          {isSignedIn ? 'Continue' : 'Log in'}
        </button>
      </AuthCard>
    );
  }

  if (state === 'failed') {
    return (
      <AuthCard title="That link didn't work" subtitle={error}>
        {isSignedIn ? (
          <button className="btn primary block" onClick={onResend} disabled={resent}>
            {resent ? 'New link sent' : 'Send a new link'}
          </button>
        ) : (
          <Link className="btn primary block" to="/login">
            Log in
          </Link>
        )}
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Verify your email" subtitle={user ? `We sent a link to ${user.email}.` : 'Check your inbox for a verification link.'}>
      {isSignedIn ? (
        <>
          {resent && <p className="switch">Link resent — check your inbox.</p>}
          <button className="btn primary block" onClick={onResend} disabled={resent}>
            Resend link
          </button>
          <p className="switch">
            <Link to={next}>Skip for now</Link>
          </p>
        </>
      ) : (
        <p className="switch">
          <Link to="/login">Back to log in</Link>
        </p>
      )}
    </AuthCard>
  );
}

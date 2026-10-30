import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import AuthCard from '../components/AuthCard';
import { resetPassword } from '../authSlice';
import { showToast } from '@/features/ui/uiSlice';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('oobCode') || params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    const res = await dispatch(resetPassword({ token, password }));
    if (resetPassword.fulfilled.match(res)) {
      dispatch(showToast('Password updated — log in with your new password.'));
      navigate('/login');
    } else {
      setError(res.error?.message || 'Something went wrong.');
    }
  }

  if (!token) {
    return (
      <AuthCard title="Invalid link" subtitle="This reset link is missing its token.">
        <p className="switch">
          <Link to="/forgot">Request a new one</Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password" subtitle="Make it at least 8 characters, and not all numbers.">
      <form onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="password">New password</label>
          <input
            id="password"
            className="input"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="confirm">Confirm password</label>
          <input
            id="confirm"
            className="input"
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        {error && <p className="form-error">{error}</p>}
        <button className="btn primary block" type="submit">
          Update password
        </button>
      </form>
      <p className="switch">
        <Link to="/login">Back to log in</Link>
      </p>
    </AuthCard>
  );
}

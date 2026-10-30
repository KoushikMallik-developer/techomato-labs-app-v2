import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import AuthCard from '@/features/auth/components/AuthCard';
import { adminLogin, selectAdminStatus, selectAdminError, clearAdminError } from '../adminSlice';

/** No signup, no guest option, no "forgot password" — admin access is a
 * single pre-seeded credential, not a self-serve account. */
export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const status = useSelector(selectAdminStatus);
  const error = useSelector(selectAdminError);

  async function onSubmit(e) {
    e.preventDefault();
    dispatch(clearAdminError());
    const res = await dispatch(adminLogin({ email, password }));
    if (adminLogin.fulfilled.match(res)) navigate('/admin');
  }

  return (
    <AuthCard title="Admin login" subtitle="Review and approve Community Circuits submissions.">
      <form onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="admin-email">Email</label>
          <input
            id="admin-email"
            className="input"
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            className="input"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="form-error">{error}</p>}
        <button className="btn primary block" type="submit" disabled={status === 'loading'}>
          {status === 'loading' ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </AuthCard>
  );
}

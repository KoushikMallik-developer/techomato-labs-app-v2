import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import AuthCard from '../components/AuthCard';
import { requestPasswordReset } from '../authSlice';

export default function ForgotPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const dispatch = useDispatch();

  async function onSubmit(e) {
    e.preventDefault();
    await dispatch(requestPasswordReset(email));
    // The API always answers 202 here, whether or not the address has an
    // account, so this can't be used to probe for registered emails.
    setSent(true);
  }

  if (sent) {
    return (
      <AuthCard title="Check your email" subtitle={`If an account exists for ${email}, a reset link is on its way.`}>
        <p className="switch">
          <Link to="/login">Back to log in</Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Reset password" subtitle="Enter the email on your account and we'll get you a reset link.">
      <form onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            className="input"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <button className="btn primary block" type="submit">
          Send reset link
        </button>
      </form>
      <p className="switch">
        <Link to="/login">Back to log in</Link>
      </p>
    </AuthCard>
  );
}

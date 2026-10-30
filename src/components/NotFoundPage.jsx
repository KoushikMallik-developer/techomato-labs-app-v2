import { Link } from 'react-router-dom';
import Nav from './Nav';

export default function NotFoundPage() {
  return (
    <div className="page">
      <Nav />
      <div className="container wrap" style={{ textAlign: 'center' }}>
        <h1>Page not found</h1>
        <p className="muted">That page doesn&apos;t exist.</p>
        <Link to="/" className="btn primary lg" style={{ marginTop: 16 }}>
          Back home
        </Link>
      </div>
    </div>
  );
}

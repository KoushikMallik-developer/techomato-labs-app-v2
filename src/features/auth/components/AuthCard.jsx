import { Link } from 'react-router-dom';
import BrandMark from '@/components/BrandMark';
import CircuitThumbnail from '@/components/CircuitThumbnail';
import { useLiveCircuit } from '@/components/useLiveCircuit';

export default function AuthCard({ title, subtitle, children }) {
  const { parts, wires, glow, cm, near } = useLiveCircuit();

  return (
    <div className="auth">
      <aside className="auth-art">
        <Link to="/" className="brand">
          <BrandMark size={26} />
          Techomato Labs
        </Link>

        <div className="auth-art-mid">
          <span className="auth-eyebrow">The browser-based Arduino playground</span>
          <p className="auth-art-line">Build circuits before you build circuits.</p>
          <p className="auth-art-sub">
            Drag real components onto a breadboard, wire them pin by pin, write an actual Arduino sketch, and watch
            the whole thing come alive — no hardware, no toolchain, nothing to install.
          </p>

          <div className="auth-demo">
            <div className="auth-demo-bar">
              <span className="auth-demo-dots">
                <i />
                <i />
                <i />
              </span>
              <em>parking-sensor.ino</em>
            </div>
            <div className="auth-demo-svg">
              <CircuitThumbnail parts={parts} wires={wires} liveGlow={glow} />
            </div>
            <div className="auth-demo-read">
              <span className={`auth-demo-dot${near ? ' near' : ''}`} />
              distance = {cm} cm
            </div>
          </div>

          <p className="auth-demo-cap">
            Running live: an ultrasonic parking sensor. The LEDs switch and the buzzer fires as the distance
            crosses 20&nbsp;cm — the same behaviour the sketch would produce on a real breadboard.
          </p>

          <ul className="auth-stats">
            <li>
              <strong>19</strong> components
            </li>
            <li>
              <strong>2D + 3D</strong> views
            </li>
            <li>
              <strong>Real</strong> circuit solver
            </li>
          </ul>
        </div>

        <small>&copy; {new Date().getFullYear()} Techomato Labs — built for makers, students, and tinkerers.</small>
      </aside>

      <main className="auth-form">
        <div className="auth-form-inner">
          <Link to="/" className="auth-back">
            <BrandMark size={22} />
            Techomato Labs
          </Link>
          <div className="auth-card">
            <h1>{title}</h1>
            <p className="auth-subtitle">{subtitle}</p>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

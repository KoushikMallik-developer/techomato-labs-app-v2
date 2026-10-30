import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Nav from '@/components/Nav';
import CircuitThumbnail from '@/components/CircuitThumbnail';
import { useLiveCircuit } from '@/components/useLiveCircuit';
import { selectIsSignedIn } from '@/features/auth/authSlice';
import { PALETTE, ICONS } from '@/features/editor/engine/constants';

const STEPS = [
  { title: 'Pick a part', body: 'Drag an LED, sensor, motor, or display from the parts dock onto the board.' },
  { title: 'Wire it up', body: 'Tap a pin, then another, to connect it — to the Arduino, the breadboard, or another part.' },
  { title: 'Write the sketch', body: 'Real Arduino code: pinMode, digitalWrite, analogRead, Serial — all of it.' },
  { title: 'Press Run', body: 'Watch LEDs glow, motors spin, and the serial monitor fill up in real time.' },
];

const FEATURES = [
  { title: '19 real components', body: 'LEDs, sensors, displays, motors, and more, each modeled with real electrical behavior.' },
  { title: 'A real circuit solver', body: 'Nodal analysis under the hood — wire something wrong and it behaves like it would on a breadboard.' },
  { title: '2D and 3D views', body: 'Flip between a clean schematic-style board and a 3D breadboard you can orbit.' },
  { title: 'Share your builds', body: 'Publish a circuit to Community Circuits, get likes and comments, remix what others made.' },
];

function FeatureIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export default function LandingPage() {
  const isSignedIn = useSelector(selectIsSignedIn);
  const primaryHref = isSignedIn ? '/projects' : '/signup';
  const { parts: heroParts, wires: heroWires, glow: heroGlow, cm, near } = useLiveCircuit();

  return (
    <div className="page">
      <Nav active="" />
      <div className="container hero">
        <div>
          <h1>
            Build circuits <em>before you build circuits.</em>
          </h1>
          <p className="lede">
            Techomato Labs is a browser-based Arduino playground. Drag parts onto a breadboard, wire them up, write
            real Arduino code, and watch it run &mdash; no hardware required.
          </p>
          <div className="cta-row">
            <Link to={primaryHref} className="btn primary lg">
              {isSignedIn ? 'Go to your projects' : 'Start building, free'}
            </Link>
            <Link to="/community" className="btn lg">
              Browse Community Circuits
            </Link>
          </div>
          <p className="fine">Free to sign up, and your first circuit is ready the moment you verify your email.</p>
        </div>
        <div className="hero-stage">
          <div className="hero-demo">
            <div className="hero-winbar">
              <div className="dots">
                <span />
                <span />
                <span />
              </div>
              <span className="file">parking-sensor.ino</span>
            </div>
            <div className="hero-svg">
              <CircuitThumbnail parts={heroParts} wires={heroWires} liveGlow={heroGlow} />
            </div>
          </div>
          <div className="hero-read">
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: near ? 'var(--stop)' : 'var(--ok)' }} />
            distance = {cm} cm
          </div>
        </div>
      </div>

      <div className="container band">
        <h2>How it works</h2>
        <ol className="steps">
          {STEPS.map((s, i) => (
            <li key={i} className="glass">
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
      </div>

      <div className="container band">
        <h2>Everything you need to prototype</h2>
        <div className="feat-grid">
          {FEATURES.map((f) => (
            <div className="feat" key={f.title}>
              <FeatureIcon />
              <div>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="container band">
        <h2>A real parts bin</h2>
        <div className="parts-row">
          {PALETTE.map(([type, label]) => (
            <div className="part-pill" key={type}>
              <span dangerouslySetInnerHTML={{ __html: ICONS[type] }} />
              {label}
            </div>
          ))}
        </div>
      </div>

      <div className="container">
        <div className="cta-band">
          <h2>Your next circuit is one drag away.</h2>
          <Link to={primaryHref} className="btn primary lg">
            {isSignedIn ? 'Go to your projects' : 'Start building, free'}
          </Link>
        </div>
        <footer className="foot">
          <span>&copy; {new Date().getFullYear()} Techomato Labs</span>
          <nav>
            <Link to="/community">Community Circuits</Link>
            <Link to="/login">Log in</Link>
            <Link to="/signup">Sign up</Link>
          </nav>
        </footer>
      </div>
    </div>
  );
}

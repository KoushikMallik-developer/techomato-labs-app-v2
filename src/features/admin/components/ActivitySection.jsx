import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const RANGES = [
  { id: '24h', label: 'Last 24 hours' },
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
];

const fmt = (ts, hourly) =>
  new Date(ts).toLocaleString(
    [],
    hourly
      ? { month: 'short', day: 'numeric', hour: 'numeric' }
      : { month: 'short', day: 'numeric' },
  );

function BarChart({ title, values, edges, cap, hourly }) {
  const max = Math.max(1, ...values);
  const capped = values.some((v) => v >= cap);
  const total = `${values.reduce((a, b) => a + b, 0)}${capped ? '+' : ''}`;
  const w = 100 / values.length;
  return (
    <figure className="adm-chart glass">
      <figcaption>
        <span className="muted small">{title}</span>
        <b>{total}</b>
      </figcaption>
      <svg
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${title}: ${total} in total`}
      >
        {values.map((v, i) => (
          <rect
            key={edges[i]}
            x={i * w + w * 0.12}
            width={w * 0.76}
            y={40 - (v / max) * 38}
            height={(v / max) * 38 || 0.6}
            rx="0.6"
          >
            <title>{`${fmt(edges[i], hourly)}: ${v}${v >= cap ? '+' : ''}`}</title>
          </rect>
        ))}
      </svg>
      <div className="adm-axis small muted">
        <span>{fmt(edges[0], hourly)}</span>
        <span>{fmt(edges[values.length - 1], hourly)}</span>
      </div>
    </figure>
  );
}

/** New users, circuits shared to Community and discussion posts over time, per hour for the last day or per day for a week or a month. */
export default function ActivitySection() {
  const [range, setRange] = useState('7d');
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    setData(null);
    setFailed(false);
    api.adminActivity(range).then(
      (d) => live && setData(d),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [range]);

  const hourly = range === '24h';
  return (
    <section className="adm-activity" aria-label="Activity">
      <div className="row adm-activity-head">
        <h2>New activity</h2>
        <div className="seg" role="group" aria-label="Time range" style={{ margin: 0 }}>
          {RANGES.map((r) => (
            <button
              key={r.id}
              className={range === r.id ? 'on' : ''}
              aria-pressed={range === r.id}
              onClick={() => setRange(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      {failed && <p className="muted">Could not load the activity counts.</p>}
      {!failed && !data && <p className="muted">Loading&hellip;</p>}
      {data && (
        <div className="adm-charts">
          <BarChart
            title="Users"
            values={data.users}
            edges={data.edges}
            cap={data.caps.users}
            hourly={hourly}
          />
          <BarChart
            title="Circuits shared"
            values={data.circuits}
            edges={data.edges}
            cap={data.caps.circuits}
            hourly={hourly}
          />
          <BarChart
            title="Discussion posts"
            values={data.posts}
            edges={data.edges}
            cap={data.caps.posts}
            hourly={hourly}
          />
        </div>
      )}
    </section>
  );
}

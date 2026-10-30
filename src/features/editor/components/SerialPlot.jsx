import { useMemo } from 'react';

const MAX_POINTS = 200;
const MAX_SERIES = 4;
const COLORS = ['#4cc9f0', '#ffd166', '#f15bb5', '#80ed99'];
const W = 600;
const H = 200;
// A number, optionally named like the Arduino IDE plotter: `temp:21.5` or `pot = 512`.
const VALUE_RE = /(?:([A-Za-z_]\w*)\s*[:=]\s*)?(-?\d+(?:\.\d+)?)/g;

/** Turns serial text into up to four series from the last MAX_POINTS lines that hold numbers. */
export function parseSeries(text) {
  // Lines the simulator itself writes (warnings, Running/Stopped) are not sketch output.
  const lines = text
    .split('\n')
    .filter((l) => /\d/.test(l) && !/^(⚠️|▶|■|❌)/.test(l))
    .slice(-MAX_POINTS);
  const series = [];
  lines.forEach((line, x) => {
    [...line.matchAll(VALUE_RE)].slice(0, MAX_SERIES).forEach((m, i) => {
      series[i] ??= { label: '', points: [] };
      if (m[1]) series[i].label = m[1];
      series[i].points.push([x, Number(m[2])]);
    });
  });
  return series.map((s, i) => ({ ...s, label: s.label || `value ${i + 1}` }));
}

/** A live line graph of the numbers a sketch prints to Serial. */
export default function SerialPlot({ serialText }) {
  const { series, min, max, count } = useMemo(() => {
    const s = parseSeries(serialText);
    const values = s.flatMap((x) => x.points.map((p) => p[1]));
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    return { series: s, min: lo, max: hi === lo ? lo + 1 : hi, count: Math.max(1, ...s.flatMap((x) => x.points.map((p) => p[0]))) };
  }, [serialText]);

  if (series.length === 0) {
    return <p className="editor-serial">Print numbers with Serial.println(value) (or name:value) and press Run to plot them.</p>;
  }
  const y = (v) => H - ((v - min) / (max - min)) * H;
  return (
    <div className="serial-plot">
      <div className="serial-plot-legend small">
        {series.map((s, i) => (
          <span key={i} style={{ color: COLORS[i] }}>
            ■ {s.label} {s.points.at(-1)[1]}
          </span>
        ))}
        <span className="muted">
          {min} – {max}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Serial plotter">
        {series.map((s, i) => (
          <polyline
            key={i}
            fill="none"
            stroke={COLORS[i]}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            points={s.points.map(([x, v]) => `${(x / count) * W},${y(v)}`).join(' ')}
          />
        ))}
      </svg>
    </div>
  );
}

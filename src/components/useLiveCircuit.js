import { useEffect, useMemo, useRef, useState } from 'react';
import { buildTemplate } from '@/lib/templates';

const NEAR_CM = 20;

/**
 * Drives the parking-sensor demo's sensor distance on a slow sine sweep and
 * derives which parts should light up, mirroring that sketch's own `cm < 20`
 * threshold. Purely decorative marketing chrome — it never touches the
 * simulation engine or the shared `sim` singleton, so it can run anywhere.
 */
export function useLiveCircuit() {
  const doc = useMemo(() => buildTemplate('parking'), []);
  const [cm, setCm] = useState(34);
  const rafRef = useRef(null);

  useEffect(() => {
    const start = performance.now();
    function tick(now) {
      setCm(Math.round(34 + 26 * Math.sin((2 * Math.PI * (now - start)) / 6000)));
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const near = cm < NEAR_CM;

  const parts = useMemo(
    () => doc.parts.map((p) => (p.type === 'sonar' ? { ...p, props: { ...p.props, cm } } : p)),
    [doc, cm],
  );

  const glow = useMemo(() => {
    const red = doc.parts.find((p) => p.type === 'led' && p.props.color === 'red');
    const green = doc.parts.find((p) => p.type === 'led' && p.props.color === 'green');
    const buzzer = doc.parts.find((p) => p.type === 'buzzer');
    const g = {};
    if (red) g[red.id] = near;
    if (green) g[green.id] = !near;
    if (buzzer) g[buzzer.id] = near;
    return g;
  }, [doc, near]);

  return { parts, wires: doc.wires, glow, cm, near };
}

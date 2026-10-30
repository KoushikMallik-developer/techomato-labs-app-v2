import { useEffect, useRef, useState } from 'react';

/**
 * Mounts the Three.js 3D viewer into a plain div — only rendered while
 * view === '3d'. `three` is a ~500KB dependency used only here, so it's
 * dynamically imported instead of bundled into everyone's initial page
 * load (see the code-splitting warning `vite build` gives without this).
 */
export default function Board3D({ parts, wires, running, callbacks, onEngineReady }) {
  const containerRef = useRef(null);
  const engineRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    let cancelled = false;
    import('../engine/render3d').then(({ createBoard3D }) => {
      if (cancelled) return;
      const engine = createBoard3D(containerRef.current, {
        onAddWire: (a, b) => callbacksRef.current?.onAddWire?.(a, b),
        onDeleteWire: (id) => callbacksRef.current?.onDeleteWire?.(id),
        onDeletePart: (id) => callbacksRef.current?.onDeletePart?.(id),
        onMovePart: (id, x, y) => callbacksRef.current?.onMovePart?.(id, x, y),
        onRotatePart: (id) => callbacksRef.current?.onRotatePart?.(id),
        onSetPartProp: (id, key, value) => callbacksRef.current?.onSetPartProp?.(id, key, value),
        onAddPart: (type, x, y) => callbacksRef.current?.onAddPart?.(type, x, y),
        onSelectionChange: (sel) => callbacksRef.current?.onSelectionChange?.(sel),
        onLiveResolve: () => callbacksRef.current?.onLiveResolve?.(),
        onStatus: (text) => callbacksRef.current?.onStatus?.(text),
      });
      engineRef.current = engine;
      // The [parts, wires, running] effect below may already have run once
      // with engineRef.current still null (this import is async), so do the
      // initial sync here instead of waiting for props to change again.
      engine.setDoc({ parts, wires, running });
      onEngineReady?.(engine);
      setLoading(false);
    });
    return () => {
      cancelled = true;
      engineRef.current?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engineRef.current?.setDoc({ parts, wires, running });
  }, [parts, wires, running]);

  return (
    <div ref={containerRef} className="editor-board3d">
      {loading && <p className="editor-board3d-loading">Loading 3D view…</p>}
    </div>
  );
}

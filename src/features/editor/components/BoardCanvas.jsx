import { useEffect, useRef } from 'react';
import { createBoardEngine } from '../engine/board';

/**
 * Thin React shell around the imperative board engine. Renders the bare
 * <svg> the engine owns entirely (innerHTML), and keeps the engine's
 * working copy of the document in sync with Redux via setDoc() — see
 * board.js for why drag gestures never round-trip through Redux.
 */
export default function BoardCanvas({ parts, wires, running, callbacks, onEngineReady }) {
  const svgRef = useRef(null);
  const engineRef = useRef(null);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    const stableCallbacks = {
      onAddWire: (a, b) => callbacksRef.current.onAddWire(a, b),
      onDeleteWire: (id) => callbacksRef.current.onDeleteWire(id),
      onDeletePart: (id) => callbacksRef.current.onDeletePart(id),
      onMovePart: (id, x, y) => callbacksRef.current.onMovePart(id, x, y),
      onRotatePart: (id) => callbacksRef.current.onRotatePart(id),
      onSetPartProp: (id, key, value) => callbacksRef.current.onSetPartProp(id, key, value),
      onAddPart: (type, x, y) => callbacksRef.current.onAddPart(type, x, y),
      onSelectionChange: (sel) => callbacksRef.current.onSelectionChange(sel),
      onStatus: (text) => callbacksRef.current.onStatus?.(text),
      onLiveResolve: () => callbacksRef.current.onLiveResolve?.(),
    };
    const engine = createBoardEngine(svgRef.current, stableCallbacks);
    engineRef.current = engine;
    engine.mount();
    onEngineReady?.(engine);
    return () => engine.unmount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engineRef.current?.setDoc({ parts, wires, running });
  }, [parts, wires, running]);

  return (
    <svg ref={svgRef} className="editor-board" xmlns="http://www.w3.org/2000/svg" aria-label="Circuit board" />
  );
}

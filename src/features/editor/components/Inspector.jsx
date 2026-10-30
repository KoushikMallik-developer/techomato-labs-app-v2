import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { TYPES, LED_COLORS, RES_VALUES, fmtOhms } from '../engine/constants';
import { setPartProp, rotatePart, deletePart, deleteWire } from '../editorSlice';

export default function Inspector({ selection, parts, running }) {
  const dispatch = useDispatch();
  const [customOhms, setCustomOhms] = useState(false);

  useEffect(() => {
    setCustomOhms(false);
  }, [selection?.kind, selection?.id]);

  if (running || !selection) return null;

  if (selection.kind === 'wire') {
    return (
      <div className="editor-inspector glass">
        <span className="editor-inspector-name">Wire</span>
        <button className="btn danger" onClick={() => dispatch(deleteWire(selection.id))}>
          Delete
        </button>
      </div>
    );
  }

  const part = parts.find((p) => p.id === selection.id);
  if (!part) return null;
  const def = TYPES[part.type];
  const knownOhms = part.type === 'resistor' && RES_VALUES.includes(part.props.ohms) && !customOhms;

  return (
    <div className="editor-inspector glass">
      <span className="editor-inspector-name">{def.label}</span>

      {part.type === 'led' && (
        <select
          aria-label="LED color"
          value={part.props.color}
          onChange={(e) => dispatch(setPartProp({ id: part.id, key: 'color', value: e.target.value }))}
        >
          {Object.keys(LED_COLORS).map((c) => (
            <option key={c} value={c}>
              {c[0].toUpperCase() + c.slice(1)}
            </option>
          ))}
        </select>
      )}

      {part.type === 'resistor' && (
        <>
          <select
            aria-label="Resistance"
            value={knownOhms ? part.props.ohms : 'custom'}
            onChange={(e) => {
              if (e.target.value === 'custom') {
                setCustomOhms(true);
                return;
              }
              setCustomOhms(false);
              dispatch(setPartProp({ id: part.id, key: 'ohms', value: Number(e.target.value) }));
            }}
          >
            {RES_VALUES.map((v) => (
              <option key={v} value={v}>
                {fmtOhms(v)}
              </option>
            ))}
            <option value="custom">Custom&hellip;</option>
          </select>
          {!knownOhms && (
            <input
              className="input"
              type="number"
              min="1"
              step="1"
              value={part.props.ohms}
              aria-label="Custom resistance in ohms"
              style={{ width: 88, minHeight: 38, padding: '6px 8px' }}
              onChange={(e) => {
                const v = Math.max(1, Math.round(Number(e.target.value)));
                if (Number.isFinite(v)) dispatch(setPartProp({ id: part.id, key: 'ohms', value: v }));
              }}
            />
          )}
        </>
      )}

      {part.type === 'dht' && (
        <>
          <label className="editor-inspector-hint">
            °C{' '}
            <input
              className="input"
              type="number"
              min="-40"
              max="80"
              step="0.5"
              aria-label="Temperature in °C"
              value={part.props.temp ?? 24}
              style={{ width: 72, minHeight: 38, padding: '6px 8px' }}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v)) dispatch(setPartProp({ id: part.id, key: 'temp', value: Math.min(80, Math.max(-40, v)) }));
              }}
            />
          </label>
          <label className="editor-inspector-hint">
            %{' '}
            <input
              className="input"
              type="number"
              min="0"
              max="100"
              step="1"
              aria-label="Humidity in %"
              value={part.props.hum ?? 50}
              style={{ width: 64, minHeight: 38, padding: '6px 8px' }}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v)) dispatch(setPartProp({ id: part.id, key: 'hum', value: Math.min(100, Math.max(0, v)) }));
              }}
            />
          </label>
        </>
      )}

      {part.type === 'arduino' ? (
        <span className="editor-inspector-hint">Drag to move</span>
      ) : part.type === 'breadboard' ? (
        <button className="btn danger" onClick={() => dispatch(deletePart(part.id))}>
          Delete
        </button>
      ) : (
        <>
          <button className="btn" onClick={() => dispatch(rotatePart(part.id))}>
            Rotate
          </button>
          <button className="btn danger" onClick={() => dispatch(deletePart(part.id))}>
            Delete
          </button>
        </>
      )}
    </div>
  );
}

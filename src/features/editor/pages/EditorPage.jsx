import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  loadProject, reset, selectEditor,
  movePart, addWire, deleteWire, deletePart, rotatePart, setPartProp, addPart, setSelection,
  setRunning,
} from '../editorSlice';
import BoardCanvas from '../components/BoardCanvas';
import Board3D from '../components/Board3D';
import Hud from '../components/Hud';
import PartsDock from '../components/PartsDock';
import ZoomControls from '../components/ZoomControls';
import Inspector from '../components/Inspector';
import ConsolePanel from '../components/ConsolePanel';
import { createInterpreter } from '../engine/interpreter';
import { solveCircuit } from '../engine/solver';
import { updateBuzzer, stopBuzzer } from '../engine/audio';
import { sim } from '../engine/engineStore';

const SERIAL_MAX = 14000;
const SERIAL_TRIM_TO = 10000;

export default function EditorPage() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const editor = useSelector(selectEditor);
  const engineRef = useRef(null);
  const engine3DRef = useRef(null);
  const [status, setStatus] = useState('');
  const [serialText, setSerialText] = useState('');
  const serialBufRef = useRef('');
  const serialFlushScheduled = useRef(false);

  const writeSerial = useCallback((text) => {
    serialBufRef.current += text;
    if (serialBufRef.current.length > SERIAL_MAX) serialBufRef.current = serialBufRef.current.slice(-SERIAL_TRIM_TO);
    if (!serialFlushScheduled.current) {
      serialFlushScheduled.current = true;
      requestAnimationFrame(() => {
        serialFlushScheduled.current = false;
        setSerialText(serialBufRef.current);
      });
    }
  }, []);

  const interpreterRef = useRef(null);
  if (!interpreterRef.current) {
    interpreterRef.current = createInterpreter({
      getDoc: () => engineRef.current?.getDoc() ?? { parts: [], wires: [] },
      serialWrite: writeSerial,
      requestRender: () => engineRef.current?.requestRender(),
    });
  }

  useEffect(() => {
    dispatch(loadProject(id));
    return () => {
      interpreterRef.current.stop();
      stopBuzzer();
      dispatch(reset());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, id]);

  useEffect(() => {
    const t = setTimeout(() => engineRef.current?.fitView(), 280);
    return () => clearTimeout(t);
  }, [editor.sheetCollapsed]);

  useEffect(() => {
    if (editor.running) {
      interpreterRef.current.run(editor.code, { onStop: () => dispatch(setRunning(false)) });
    } else {
      interpreterRef.current.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor.running]);

  const onLiveResolve = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    solveCircuit(engine.getDoc(), (msg) => writeSerial(msg + '\n'));
    updateBuzzer(sim.buzz.__any, sim.buzzFreq);
    engine.requestRender();
  }, [writeSerial]);

  const is3D = editor.view === '3d';
  // BoardCanvas (2D) stays mounted (just hidden) while in 3D view, so its
  // own onStatus calls would otherwise keep stomping over the 3D engine's
  // status text — each engine's status only applies while it's the active
  // view.
  const is3DRef = useRef(is3D);
  is3DRef.current = is3D;

  const callbacks = {
    onAddWire: useCallback((a, b) => dispatch(addWire({ a, b })), [dispatch]),
    onDeleteWire: useCallback((wid) => dispatch(deleteWire(wid)), [dispatch]),
    onDeletePart: useCallback((pid) => dispatch(deletePart(pid)), [dispatch]),
    onMovePart: useCallback((pid, x, y) => dispatch(movePart({ id: pid, x, y })), [dispatch]),
    onRotatePart: useCallback((pid) => dispatch(rotatePart(pid)), [dispatch]),
    onSetPartProp: useCallback(
      (pid, key, value) => dispatch(setPartProp({ id: pid, key, value })),
      [dispatch],
    ),
    onAddPart: useCallback((type, x, y) => dispatch(addPart({ type, x, y })), [dispatch]),
    onSelectionChange: useCallback((sel) => dispatch(setSelection(sel)), [dispatch]),
    onLiveResolve,
  };
  const callbacks2D = { ...callbacks, onStatus: useCallback((text) => { if (!is3DRef.current) setStatus(text); }, []) };
  const callbacks3D = { ...callbacks, onStatus: useCallback((text) => { if (is3DRef.current) setStatus(text); }, []) };

  if (editor.status === 'loading' || editor.status === 'idle') {
    return (
      <div className="page">
        <div className="container wrap">
          <p className="muted">Loading&hellip;</p>
        </div>
      </div>
    );
  }
  if (editor.status === 'error') {
    return (
      <div className="page">
        <div className="container wrap">
          <p className="form-error">{editor.error}</p>
          <Link to="/projects" className="btn">
            Back to projects
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-page">
      <div className={`editor-app${editor.sheetCollapsed ? ' sheet-collapsed' : ''}`}>
        <div className="editor-stage">
          <div style={{ display: is3D ? 'none' : 'contents' }}>
            <BoardCanvas
              parts={editor.parts}
              wires={editor.wires}
              running={editor.running}
              callbacks={callbacks2D}
              onEngineReady={(engine) => (engineRef.current = engine)}
            />
          </div>
          {is3D && (
            <Board3D
              parts={editor.parts}
              wires={editor.wires}
              running={editor.running}
              callbacks={callbacks3D}
              onEngineReady={(engine) => (engine3DRef.current = engine)}
            />
          )}
        </div>

        <Hud
          name={editor.name}
          saveState={editor.saveState}
          view={editor.view}
          running={editor.running}
          projectId={editor.projectId}
          live={editor.approved}
          onAudioWarn={(msg) => writeSerial(msg + '\n')}
        />
        <PartsDock
          running={editor.running}
          onAdd={(type) => (is3D ? engine3DRef.current : engineRef.current)?.addPartAtViewCenter(type)}
        />
        <ZoomControls
          onZoomIn={() => (is3D ? engine3DRef.current : engineRef.current)?.zoomIn()}
          onZoomOut={() => (is3D ? engine3DRef.current : engineRef.current)?.zoomOut()}
          onFit={() => (is3D ? engine3DRef.current?.fit() : engineRef.current?.fitView())}
        />
        <Inspector selection={editor.selection} parts={editor.parts} running={editor.running} />
        <div className="editor-readout">
          <span className={`dot${editor.running ? ' live' : ''}`} />
          <span>{status}</span>
        </div>
        <ConsolePanel
          code={editor.code}
          activeTab={editor.activeTab}
          serialText={serialText}
          onClearSerial={() => {
            serialBufRef.current = '';
            setSerialText('');
          }}
        />
      </div>
    </div>
  );
}

import { useDispatch } from 'react-redux';
import { setCode, loadExampleCode, setActiveTab, toggleSheetCollapsed } from '../editorSlice';
import { EXAMPLES } from '@/lib/templates';
import SerialPlot from './SerialPlot';

export default function ConsolePanel({ code, activeTab, serialText, onClearSerial }) {
  const dispatch = useDispatch();

  function onTab(tab) {
    dispatch(setActiveTab(tab));
  }

  function onExample(e) {
    const idx = e.target.value;
    e.target.value = '';
    if (idx === '') return;
    dispatch(loadExampleCode(EXAMPLES[Number(idx)].code));
    dispatch(setActiveTab('code'));
  }

  function onTabKeyInsert(e) {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const el = e.target;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = el.value.slice(0, start) + '  ' + el.value.slice(end);
    dispatch(setCode(next));
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + 2;
    });
  }

  return (
    <section className="editor-console glass" aria-label="Sketch and serial monitor">
      <div className="editor-tabs">
        <button
          className="editor-grab"
          aria-label="Collapse or expand the panel"
          onClick={() => dispatch(toggleSheetCollapsed())}
        />
        <button className={`editor-tab${activeTab === 'code' ? ' on' : ''}`} onClick={() => onTab('code')}>
          Sketch
        </button>
        <button className={`editor-tab${activeTab === 'serial' ? ' on' : ''}`} onClick={() => onTab('serial')}>
          Serial
        </button>
        <button className={`editor-tab${activeTab === 'plot' ? ' on' : ''}`} onClick={() => onTab('plot')}>
          Plotter
        </button>
        <span className="editor-file">sketch.ino</span>
        <select aria-label="Load an example sketch" defaultValue="" onChange={onExample}>
          <option value="">Examples&hellip;</option>
          {EXAMPLES.map((ex, i) => (
            <option key={ex.name} value={i}>
              {ex.name}
            </option>
          ))}
        </select>
      </div>
      <div className={`editor-pane${activeTab === 'code' ? ' on' : ''}`}>
        <textarea
          className="editor-code"
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          aria-label="Arduino sketch"
          value={code}
          onChange={(e) => dispatch(setCode(e.target.value))}
          onKeyDown={onTabKeyInsert}
        />
      </div>
      <div className={`editor-pane${activeTab === 'serial' ? ' on' : ''}`}>
        <div className="editor-pane-head">
          <span>Serial monitor, 9600 baud</span>
          <button className="editor-link" onClick={onClearSerial}>
            Clear
          </button>
        </div>
        <pre className="editor-serial">
          {serialText || 'Serial output shows up here when you press Run.'}
        </pre>
      </div>
      <div className={`editor-pane${activeTab === 'plot' ? ' on' : ''}`}>
        {activeTab === 'plot' && <SerialPlot serialText={serialText} />}
      </div>
    </section>
  );
}

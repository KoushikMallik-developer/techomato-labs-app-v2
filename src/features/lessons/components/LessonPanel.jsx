import { useState } from 'react';

/** A lesson's steps beside the editor, ticked off as you go. Ticks are not saved: a lesson takes minutes. */
export default function LessonPanel({ lesson, onClose }) {
  const [done, setDone] = useState(() => new Set());
  const [open, setOpen] = useState(true);

  function toggle(i) {
    setDone((d) => {
      const next = new Set(d);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <aside className="lesson-panel glass" aria-label={`Lesson: ${lesson.title}`}>
      <div className="lesson-panel-head">
        <b>{lesson.title}</b>
        <span className="small muted">
          {done.size}/{lesson.steps.length}
        </span>
        <button className="editor-link" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? 'Hide' : 'Show'}
        </button>
        <button className="editor-link" onClick={onClose} aria-label="Close lesson">
          ✕
        </button>
      </div>
      {open && (
        <ol className="lesson-steps">
          {lesson.steps.map((step, i) => (
            <li key={i} className={done.has(i) ? 'done' : ''}>
              <label>
                <input type="checkbox" checked={done.has(i)} onChange={() => toggle(i)} /> {step}
              </label>
            </li>
          ))}
        </ol>
      )}
      {open && done.size === lesson.steps.length && <p className="small">Lesson complete. Nice work!</p>}
    </aside>
  );
}

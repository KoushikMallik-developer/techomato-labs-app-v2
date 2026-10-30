import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import AppShell from '@/components/AppShell';
import CircuitThumbnail from '@/components/CircuitThumbnail';
import { buildTemplate } from '@/lib/templates';
import { selectIsSignedIn } from '@/features/auth/authSlice';
import { createProject } from '@/features/projects/projectsSlice';
import { LESSONS } from '../lessons';

/** Guided lessons: each starts a new circuit from a template and opens the editor with the steps beside it. */
export default function LessonsPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const isSignedIn = useSelector(selectIsSignedIn);
  const [busy, setBusy] = useState(null);
  const previews = useMemo(() => Object.fromEntries(LESSONS.map((l) => [l.id, buildTemplate(l.template)])), []);

  async function onStart(lesson) {
    if (!isSignedIn) return navigate(`/login?next=${encodeURIComponent('/lessons')}`);
    setBusy(lesson.id);
    const res = await dispatch(createProject({ templateKey: lesson.template, name: `Lesson: ${lesson.title}` }));
    setBusy(null);
    if (createProject.fulfilled.match(res)) navigate(`/editor/${res.payload.id}?lesson=${lesson.id}`);
  }

  return (
    <AppShell title="Lessons">
      <div className="head">
        <div>
          <p>Step-by-step projects. Each lesson creates a circuit in your projects (it counts toward your limit).</p>
        </div>
      </div>
      <div className="cards">
        {LESSONS.map((l) => (
          <article key={l.id} className="lesson-card glass">
            <div className="thumb">
              <CircuitThumbnail parts={previews[l.id].parts} wires={previews[l.id].wires} />
            </div>
            <span className="tag">{l.level}</span>
            <h3>{l.title}</h3>
            <p className="small muted">{l.summary}</p>
            <p className="small muted">{l.steps.length} steps</p>
            <button className="btn primary" disabled={busy !== null} onClick={() => onStart(l)}>
              {busy === l.id ? 'Starting…' : 'Start lesson'}
            </button>
          </article>
        ))}
      </div>
    </AppShell>
  );
}

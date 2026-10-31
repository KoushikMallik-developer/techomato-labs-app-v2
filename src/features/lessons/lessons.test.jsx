import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, render } from '@testing-library/react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { renderWithProviders, authState, signedInUser } from '@/test-utils';
import { api } from '@/lib/api';
import { TEMPLATES } from '@/lib/templates';
import { LESSONS } from './lessons';
import LessonsPage from './pages/LessonsPage';
import LessonPanel from './components/LessonPanel';

vi.mock('@/lib/api', () => ({ api: { create: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
});

function Where() {
  const loc = useLocation();
  return <div>at {loc.pathname + loc.search}</div>;
}

function renderPage(preloadedState) {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<LessonsPage />} />
      <Route path="*" element={<Where />} />
    </Routes>,
    { preloadedState },
  );
}

describe('lessons', () => {
  it('each lesson uses a real template and has steps', () => {
    const keys = TEMPLATES.map((t) => t.key);
    for (const l of LESSONS) {
      expect(keys).toContain(l.template);
      expect(l.steps.length).toBeGreaterThan(0);
    }
  });

  it('starting a lesson creates the circuit and opens the editor with the lesson beside it', async () => {
    api.create.mockResolvedValue({ id: 'p-9', name: 'Lesson: Blink an LED' });
    renderPage({ auth: authState({ user: signedInUser() }) });
    fireEvent.click(screen.getAllByText('Start lesson')[0]);
    expect(await screen.findByText('at /editor/p-9?lesson=blink', {}, { timeout: 5000 })).toBeInTheDocument(); // a busy machine can take over the 1 s default
    expect(api.create).toHaveBeenCalledWith('blink', 'Lesson: Blink an LED');
  });

  it('sends a signed-out visitor to log in first', () => {
    renderPage({ auth: authState() });
    fireEvent.click(screen.getAllByText('Start lesson')[0]);
    expect(screen.getByText(/at \/login/)).toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();
  });

  it('the panel ticks steps off and says when the lesson is done', () => {
    const lesson = { title: 'Tiny', steps: ['one', 'two'] };
    render(<LessonPanel lesson={lesson} onClose={() => {}} />);
    expect(screen.getByText('0/2')).toBeInTheDocument();
    screen.getAllByRole('checkbox').forEach((c) => fireEvent.click(c));
    expect(screen.getByText('2/2')).toBeInTheDocument();
    expect(screen.getByText(/Lesson complete/)).toBeInTheDocument();
  });
});

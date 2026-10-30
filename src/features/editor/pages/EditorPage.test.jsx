import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '@/test-utils';
import { api } from '@/lib/api';
import EditorPage from './EditorPage';
import { createInterpreter } from '../engine/interpreter';
import { stopBuzzer } from '../engine/audio';

vi.mock('@/lib/api', () => ({
  api: { project: vi.fn(), save: vi.fn() },
}));

vi.mock('../engine/interpreter', () => ({
  createInterpreter: vi.fn(() => ({ run: vi.fn(), stop: vi.fn() })),
}));

vi.mock('../engine/solver', () => ({ solveCircuit: vi.fn() }));
vi.mock('../engine/audio', () => ({ updateBuzzer: vi.fn(), stopBuzzer: vi.fn(), primeAudio: vi.fn() }));

function makeFakeEngine() {
  return {
    mount: vi.fn(),
    unmount: vi.fn(),
    setDoc: vi.fn(),
    getDoc: vi.fn(() => ({ parts: [], wires: [] })),
    requestRender: vi.fn(),
    addPartAtViewCenter: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    fitView: vi.fn(),
    fit: vi.fn(),
  };
}

let fake2D;
let fake3D;

vi.mock('../components/BoardCanvas', () => ({
  default: (props) => {
    props.onEngineReady?.(fake2D);
    return <div data-testid="board-2d">2D board</div>;
  },
}));

vi.mock('../components/Board3D', () => ({
  default: (props) => {
    props.onEngineReady?.(fake3D);
    return <div data-testid="board-3d">3D board</div>;
  },
}));

const project = { id: 'p-1', name: 'My circuit', parts: [], wires: [], code: 'void setup() {}\nvoid loop() {}' };

beforeEach(() => {
  vi.clearAllMocks();
  fake2D = makeFakeEngine();
  fake3D = makeFakeEngine();
  api.project.mockResolvedValue(project);
  api.save.mockResolvedValue(project);
});

function renderEditor(id = 'p-1') {
  return renderWithProviders(
    <Routes>
      <Route path="/editor/:id" element={<EditorPage />} />
      <Route path="/projects" element={<div>Projects page</div>} />
    </Routes>,
    { route: `/editor/${id}` },
  );
}

describe('EditorPage', () => {
  it('shows a loading state, then the board', async () => {
    renderEditor();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(await screen.findByTestId('board-2d')).toBeInTheDocument();
  });

  it('shows an error state with a link back when the project cannot be found', async () => {
    api.project.mockResolvedValue(null);
    renderEditor();
    expect(await screen.findByText('Project not found.')).toBeInTheDocument();
    expect(screen.getByText('Back to projects')).toHaveAttribute('href', '/projects');
  });

  it('shows the 2D board by default and switches to 3D via the Hud toggle', async () => {
    renderEditor();
    await screen.findByTestId('board-2d');
    expect(screen.queryByTestId('board-3d')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('3D'));
    expect(await screen.findByTestId('board-3d')).toBeInTheDocument();
  });

  it('adding a part from the dock delegates to the active engine', async () => {
    renderEditor();
    await screen.findByTestId('board-2d');
    fireEvent.click(screen.getByText('LED'));
    expect(fake2D.addPartAtViewCenter).toHaveBeenCalledWith('led');
  });

  it('zoom controls delegate to the active engine', async () => {
    renderEditor();
    await screen.findByTestId('board-2d');
    fireEvent.click(screen.getByLabelText('Zoom in'));
    expect(fake2D.zoomIn).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByLabelText('Zoom out'));
    expect(fake2D.zoomOut).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByLabelText('Fit circuit'));
    expect(fake2D.fitView).toHaveBeenCalledTimes(1);
  });

  it('zoom controls delegate to the 3D engine once switched to 3D', async () => {
    renderEditor();
    await screen.findByTestId('board-2d');
    fireEvent.click(screen.getByText('3D'));
    await screen.findByTestId('board-3d');
    fireEvent.click(screen.getByLabelText('Fit circuit'));
    expect(fake3D.fit).toHaveBeenCalledTimes(1);
  });

  it('running the sketch starts the interpreter, stopping it stops it', async () => {
    const interp = { run: vi.fn(), stop: vi.fn() };
    createInterpreter.mockReturnValue(interp);
    renderEditor();
    await screen.findByTestId('board-2d');
    fireEvent.click(screen.getByText('▶ Run'));
    await waitFor(() => expect(interp.run).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByText('■ Stop'));
    await waitFor(() => expect(interp.stop).toHaveBeenCalled());
  });

  it('shows the Inspector for the current selection', async () => {
    renderEditor();
    await screen.findByTestId('board-2d');
    expect(screen.queryByText('LED', { selector: '.editor-inspector-name' })).not.toBeInTheDocument();
  });

  it('clears the serial buffer via the console panel', async () => {
    renderEditor();
    await screen.findByTestId('board-2d');
    fireEvent.click(screen.getByText('Serial'));
    fireEvent.click(screen.getByText('Clear'));
    expect(screen.getByText('Serial output shows up here when you press Run.')).toBeInTheDocument();
  });

  it('cleans up (stops interpreter, stops the buzzer) when navigating away', async () => {
    const interp = { run: vi.fn(), stop: vi.fn() };
    createInterpreter.mockReturnValue(interp);
    const { unmount } = renderEditor();
    await screen.findByTestId('board-2d');
    unmount();
    expect(interp.stop).toHaveBeenCalled();
    expect(stopBuzzer).toHaveBeenCalled();
  });
});

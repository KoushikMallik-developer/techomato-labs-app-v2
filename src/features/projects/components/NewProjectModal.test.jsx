import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '@/test-utils';
import { api } from '@/lib/api';
import NewProjectModal from './NewProjectModal';

vi.mock('@/lib/api', () => ({
  api: { create: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function renderModal(close = vi.fn()) {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<NewProjectModal close={close} />} />
      <Route path="/editor/:id" element={<div>Editor page</div>} />
    </Routes>,
  );
}

describe('NewProjectModal', () => {
  it('starts on the "blank" template and lets you pick another', () => {
    renderModal();
    const blank = screen.getByText('Blank breadboard').closest('button');
    expect(blank.className).toContain('on');
    const another = screen.getAllByRole('button', { name: /./ }).find((b) => b.className.includes('tpl') && b !== blank);
    fireEvent.click(another);
    expect(another.className).toContain('on');
    expect(blank.className).not.toContain('on');
  });

  it('creates the project with the typed name and the selected template, then navigates to the editor', async () => {
    api.create.mockResolvedValue({ id: 'p-new', name: 'My blinker' });
    const close = vi.fn();
    renderModal(close);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'My blinker' } });
    fireEvent.click(screen.getByText('Create project'));
    await waitFor(() => expect(api.create).toHaveBeenCalledWith('blank', 'My blinker'));
    expect(close).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Editor page')).toBeInTheDocument();
  });

  it('falls back to the template name when no name is typed', async () => {
    api.create.mockResolvedValue({ id: 'p-new', name: 'Blank circuit' });
    renderModal();
    fireEvent.click(screen.getByText('Create project'));
    await waitFor(() => expect(api.create).toHaveBeenCalled());
    const [, name] = api.create.mock.calls[0];
    expect(name).toBeTruthy();
  });

  it('disables buttons and shows a busy label while creating', async () => {
    let resolveCreate;
    api.create.mockReturnValue(new Promise((res) => { resolveCreate = res; }));
    renderModal();
    fireEvent.click(screen.getByText('Create project'));
    expect(await screen.findByText('Creating…')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeDisabled();
    resolveCreate({ id: 'p-1', name: 'x' });
    await waitFor(() => expect(screen.getByText('Editor page')).toBeInTheDocument());
  });

  it('calls close() when Cancel is clicked', () => {
    const close = vi.fn();
    renderModal(close);
    fireEvent.click(screen.getByText('Cancel'));
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('does not navigate if creation fails', async () => {
    api.create.mockRejectedValue(new Error('nope'));
    const close = vi.fn();
    renderModal(close);
    fireEvent.click(screen.getByText('Create project'));
    await waitFor(() => expect(screen.getByText('Create project')).not.toBeDisabled());
    expect(close).not.toHaveBeenCalled();
  });
});

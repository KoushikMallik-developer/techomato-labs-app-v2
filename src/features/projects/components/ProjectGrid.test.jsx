import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProjectGrid from './ProjectGrid';

const items = [
  { id: 'p-1', name: 'First', parts: [], wires: [], updatedAt: Date.now(), tags: [], folder: 'f-1' },
  { id: 'p-2', name: 'Second', parts: [], wires: [], updatedAt: Date.now(), tags: [], folder: null },
];
const folderById = new Map([['f-1', { id: 'f-1', name: 'Sensors' }]]);

describe('ProjectGrid', () => {
  it('shows an empty state with a New project shortcut when there are no items', () => {
    const onNew = vi.fn();
    render(
      <MemoryRouter>
        <ProjectGrid items={[]} folderById={new Map()} onMenu={() => {}} onNew={onNew} />
      </MemoryRouter>,
    );
    expect(screen.getByText('No projects yet')).toBeInTheDocument();
    fireEvent.click(screen.getByText('New project'));
    expect(onNew).toHaveBeenCalledTimes(1);
  });

  it('renders a card per project, resolving the folder name', () => {
    render(
      <MemoryRouter>
        <ProjectGrid items={items} folderById={folderById} onMenu={() => {}} onNew={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
    expect(screen.getByText(/· Sensors/)).toBeInTheDocument();
  });

  it('forwards onMenu to each card', () => {
    const onMenu = vi.fn();
    render(
      <MemoryRouter>
        <ProjectGrid items={items} folderById={folderById} onMenu={onMenu} onNew={() => {}} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getAllByLabelText('Project options')[0]);
    expect(onMenu).toHaveBeenCalledWith(items[0]);
  });
});

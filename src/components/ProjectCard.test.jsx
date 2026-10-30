import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProjectCard from './ProjectCard';

const project = {
  id: 'p-1',
  name: 'My first circuit',
  parts: [],
  wires: [],
  updatedAt: Date.now() - 3600_000,
  tags: [],
  published: false,
};

function renderCard(props) {
  return render(
    <MemoryRouter>
      <ProjectCard project={{ ...project, ...props }} onMenu={() => {}} {...{}} />
    </MemoryRouter>,
  );
}

describe('ProjectCard', () => {
  it('links the thumbnail and name to the editor route', () => {
    renderCard();
    const links = screen.getAllByRole('link');
    expect(links[0]).toHaveAttribute('href', '/editor/p-1');
    expect(screen.getByText('My first circuit')).toHaveAttribute('href', '/editor/p-1');
  });

  it('shows how long ago it was edited', () => {
    renderCard();
    expect(screen.getByText(/Edited 1 hour ago/)).toBeInTheDocument();
  });

  it('shows the folder name when given one', () => {
    render(
      <MemoryRouter>
        <ProjectCard project={project} folderName="Sensors" onMenu={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/· Sensors/)).toBeInTheDocument();
  });

  it('renders tags when present', () => {
    renderCard({ tags: ['beginner', 'leds'] });
    expect(screen.getByText('beginner')).toBeInTheDocument();
    expect(screen.getByText('leds')).toBeInTheDocument();
  });

  it('shows no badge when unpublished', () => {
    renderCard({ published: false });
    expect(screen.queryByText(/Community Circuits/)).not.toBeInTheDocument();
    expect(screen.queryByText('Pending approval')).not.toBeInTheDocument();
  });

  it('shows a pending badge when published but not yet approved', () => {
    renderCard({ published: true, approved: false });
    expect(screen.getByText('Pending approval')).toBeInTheDocument();
  });

  it('shows an in-community badge once approved', () => {
    renderCard({ published: true, approved: true });
    expect(screen.getByText('In Community Circuits')).toBeInTheDocument();
  });

  it('calls onMenu with the project when the options button is clicked', () => {
    const onMenu = vi.fn();
    render(
      <MemoryRouter>
        <ProjectCard project={project} onMenu={onMenu} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByLabelText('Project options'));
    expect(onMenu).toHaveBeenCalledWith(project);
  });
});

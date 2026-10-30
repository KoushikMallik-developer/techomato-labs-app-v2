import ProjectCard from '@/components/ProjectCard';

export default function ProjectGrid({ items, folderById, onMenu, onNew }) {
  if (items.length === 0) {
    return (
      <div className="empty glass">
        <h2>No projects yet</h2>
        <p className="muted">Create your first circuit to get started.</p>
        <button className="btn primary" onClick={onNew}>
          New project
        </button>
      </div>
    );
  }
  return (
    <div className="cards">
      {items.map((p) => (
        <ProjectCard key={p.id} project={p} folderName={folderById.get(p.folder)?.name} onMenu={onMenu} />
      ))}
    </div>
  );
}

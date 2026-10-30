import { Link } from 'react-router-dom';
import CircuitThumbnail from './CircuitThumbnail';

function timeAgo(ts) {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [name, secs] of units) {
    const v = Math.floor(s / secs);
    if (v >= 1) return `${v} ${name}${v > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}

export default function ProjectCard({ project, folderName, onMenu }) {
  return (
    <div className="pcard glass">
      <Link to={`/editor/${project.id}`} className="thumb" aria-label={`Open ${project.name}`}>
        <CircuitThumbnail parts={project.parts} wires={project.wires} />
      </Link>
      <div className="pcard-body">
        <Link to={`/editor/${project.id}`} className="pname">
          {project.name}
        </Link>
        <span className="small muted">
          Edited {timeAgo(project.updatedAt)}
          {folderName ? ` · ${folderName}` : ''}
        </span>
        {project.tags?.length > 0 && (
          <div className="tags">
            {project.tags.map((t) => (
              <span className="tag" key={t}>
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="pcard-foot">
        {project.published && (
          <span className="badge">{project.approved ? 'In Community Circuits' : 'Pending approval'}</span>
        )}
        <button className="icon-btn" aria-label="Project options" onClick={() => onMenu(project)}>
          &#8942;
        </button>
      </div>
    </div>
  );
}

import { PALETTE, ICONS } from '../engine/constants';

export default function PartsDock({ running, onAdd }) {
  return (
    <nav className="editor-dock glass" aria-label="Add parts">
      {PALETTE.map(([type, label]) => (
        <button
          key={type}
          className="editor-chip"
          disabled={running}
          onClick={() => onAdd(type)}
          dangerouslySetInnerHTML={{ __html: `${ICONS[type]}<span>${label}</span>` }}
        />
      ))}
    </nav>
  );
}

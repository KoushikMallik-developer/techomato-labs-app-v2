export default function ZoomControls({ onZoomIn, onZoomOut, onFit }) {
  return (
    <div className="editor-zoom">
      <button className="glass" onClick={onZoomIn} aria-label="Zoom in">
        +
      </button>
      <button className="glass" onClick={onZoomOut} aria-label="Zoom out">
        &minus;
      </button>
      <button className="glass" onClick={onFit} aria-label="Fit circuit">
        &#10530;
      </button>
    </div>
  );
}

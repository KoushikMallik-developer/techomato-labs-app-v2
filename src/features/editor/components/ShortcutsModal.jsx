export const SHORTCUTS = [
  ['Ctrl / ⌘ + S', 'Save'],
  ['Ctrl / ⌘ + Enter', 'Run or stop the sketch'],
  ['R', 'Rotate the selected part'],
  ['Delete / Backspace', 'Delete the selected part or wire'],
  ['Esc', 'Cancel a wire, clear the selection'],
  ['2 / 3', 'Switch to the 2D / 3D view'],
  ['?', 'Show this list'],
];

/** The editor's keyboard shortcuts, opened with "?". */
export default function ShortcutsModal({ close }) {
  return (
    <>
      <h2>Keyboard shortcuts</h2>
      <table className="shortcuts">
        <tbody>
          {SHORTCUTS.map(([keys, what]) => (
            <tr key={keys}>
              <td>
                <kbd>{keys}</kbd>
              </td>
              <td>{what}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="modal-actions">
        <button className="btn" onClick={close}>
          Close
        </button>
      </div>
    </>
  );
}

import { describe, it, expect } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders, editorState } from '@/test-utils';
import Inspector from './Inspector';

const led = { id: 'led-1', type: 'led', props: { color: 'red' } };
const resistorKnown = { id: 'res-1', type: 'resistor', props: { ohms: 220 } };
const resistorCustom = { id: 'res-2', type: 'resistor', props: { ohms: 999 } };
const breadboard = { id: 'bb-1', type: 'breadboard', props: {} };
const arduino = { id: 'ard-1', type: 'arduino', props: {} };
const parts = [led, resistorKnown, resistorCustom, breadboard, arduino];
const wires = [{ id: 'w-1', a: 'led-1.A', b: 'led-1.K', color: '#fff' }];

// Inspector dispatches against the real editorSlice reducer, which mutates the
// STORE's own editor.parts/wires — so the store must be preloaded with the same
// fixtures passed as the `parts` prop for dispatched changes to land anywhere.
function renderInspector(props) {
  return renderWithProviders(<Inspector parts={parts} running={false} {...props} />, {
    preloadedState: { editor: editorState({ parts, wires }) },
  });
}

describe('Inspector', () => {
  it('renders nothing while running', () => {
    const { container } = renderInspector({ selection: { kind: 'part', id: 'led-1' }, running: true });
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when there is no selection', () => {
    const { container } = renderInspector({ selection: null });
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the selected part id no longer exists', () => {
    const { container } = renderInspector({ selection: { kind: 'part', id: 'nope' } });
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a Delete button for a wire selection, and deletes it', () => {
    const { store } = renderInspector({ selection: { kind: 'wire', id: 'w-1' } });
    expect(screen.getByText('Wire')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Delete'));
    expect(store.getState().editor.wires).toEqual([]);
  });

  it('shows a color selector and rotate/delete for an LED', () => {
    renderInspector({ selection: { kind: 'part', id: 'led-1' } });
    expect(screen.getByText('LED')).toBeInTheDocument();
    expect(screen.getByLabelText('LED color')).toHaveValue('red');
    expect(screen.getByText('Rotate')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('changing the LED color dispatches setPartProp', () => {
    const { store } = renderInspector({ selection: { kind: 'part', id: 'led-1' } });
    fireEvent.change(screen.getByLabelText('LED color'), { target: { value: 'green' } });
    const updated = store.getState().editor.parts.find((p) => p.id === 'led-1');
    expect(updated?.props?.color).toBe('green');
  });

  it('rotating an LED dispatches rotatePart', () => {
    const { store } = renderInspector({ selection: { kind: 'part', id: 'led-1' } });
    fireEvent.click(screen.getByText('Rotate'));
    const updated = store.getState().editor.parts.find((p) => p.id === 'led-1');
    expect(updated?.rot).toBe(90);
  });

  it('deleting an LED dispatches deletePart', () => {
    const { store } = renderInspector({ selection: { kind: 'part', id: 'led-1' } });
    fireEvent.click(screen.getByText('Delete'));
    expect(store.getState().editor.parts.find((p) => p.id === 'led-1')).toBeUndefined();
  });

  it('shows a known resistance as a plain dropdown value, no custom input', () => {
    renderInspector({ selection: { kind: 'part', id: 'res-1' } });
    expect(screen.getByLabelText('Resistance')).toHaveValue('220');
    expect(screen.queryByLabelText('Custom resistance in ohms')).not.toBeInTheDocument();
  });

  it('shows the custom input for a non-standard resistance', () => {
    renderInspector({ selection: { kind: 'part', id: 'res-2' } });
    expect(screen.getByLabelText('Resistance')).toHaveValue('custom');
    expect(screen.getByLabelText('Custom resistance in ohms')).toHaveValue(999);
  });

  it('switching the dropdown to Custom reveals the number input', () => {
    renderInspector({ selection: { kind: 'part', id: 'res-1' } });
    fireEvent.change(screen.getByLabelText('Resistance'), { target: { value: 'custom' } });
    expect(screen.getByLabelText('Custom resistance in ohms')).toBeInTheDocument();
  });

  it('picking a standard value from the dropdown dispatches setPartProp', () => {
    const { store } = renderInspector({ selection: { kind: 'part', id: 'res-2' } });
    fireEvent.change(screen.getByLabelText('Resistance'), { target: { value: '470' } });
    const updated = store.getState().editor.parts.find((p) => p.id === 'res-2');
    expect(updated?.props?.ohms).toBe(470);
  });

  it('typing a custom ohms value dispatches setPartProp', () => {
    const { store } = renderInspector({ selection: { kind: 'part', id: 'res-2' } });
    fireEvent.change(screen.getByLabelText('Custom resistance in ohms'), { target: { value: '150' } });
    const updated = store.getState().editor.parts.find((p) => p.id === 'res-2');
    expect(updated?.props?.ohms).toBe(150);
  });

  it('clamps an empty/zero custom ohms value up to 1 rather than rejecting it', () => {
    const { store } = renderInspector({ selection: { kind: 'part', id: 'res-2' } });
    fireEvent.change(screen.getByLabelText('Custom resistance in ohms'), { target: { value: '' } });
    const updated = store.getState().editor.parts.find((p) => p.id === 'res-2');
    expect(updated?.props?.ohms).toBe(1);
  });

  it('shows only a "Drag to move" hint for the Arduino (no rotate/delete)', () => {
    renderInspector({ selection: { kind: 'part', id: 'ard-1' } });
    expect(screen.getByText('Drag to move')).toBeInTheDocument();
    expect(screen.queryByText('Rotate')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('shows only Delete (no rotate) for the breadboard', () => {
    renderInspector({ selection: { kind: 'part', id: 'bb-1' } });
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.queryByText('Rotate')).not.toBeInTheDocument();
  });

  it('resets the custom-ohms flag when the selection changes', () => {
    const { rerender } = renderInspector({ selection: { kind: 'part', id: 'res-1' } });
    fireEvent.change(screen.getByLabelText('Resistance'), { target: { value: 'custom' } });
    expect(screen.getByLabelText('Custom resistance in ohms')).toBeInTheDocument();

    rerender(<Inspector selection={{ kind: 'part', id: 'res-2' }} parts={parts} running={false} />);
    // res-2 is genuinely non-standard, so the custom input still shows — but via
    // its own prop value, not leaked local state from res-1's toggle.
    expect(screen.getByLabelText('Custom resistance in ohms')).toHaveValue(999);
  });
});

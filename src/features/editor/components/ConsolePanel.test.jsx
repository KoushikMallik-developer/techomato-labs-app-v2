import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils';
import ConsolePanel from './ConsolePanel';
import { EXAMPLES } from '@/lib/templates';

function renderPanel(props = {}) {
  return renderWithProviders(
    <ConsolePanel code="void setup() {}" activeTab="code" serialText="" onClearSerial={() => {}} {...props} />,
  );
}

describe('ConsolePanel', () => {
  it('shows the Sketch tab as active by default and the code', () => {
    renderPanel();
    expect(screen.getByText('Sketch').className).toContain('on');
    expect(screen.getByLabelText('Arduino sketch')).toHaveValue('void setup() {}');
  });

  it('switches to the Serial tab and shows the placeholder when there is no output yet', () => {
    const { store } = renderPanel();
    fireEvent.click(screen.getByText('Serial'));
    expect(store.getState().editor.activeTab).toBe('serial');
  });

  it('shows serial output text when given', () => {
    renderPanel({ activeTab: 'serial', serialText: 'distance: 34cm\n' });
    expect(screen.getByText(/distance: 34cm/)).toBeInTheDocument();
  });

  it('calls onClearSerial when Clear is clicked', () => {
    const onClearSerial = vi.fn();
    renderPanel({ activeTab: 'serial', onClearSerial });
    fireEvent.click(screen.getByText('Clear'));
    expect(onClearSerial).toHaveBeenCalledTimes(1);
  });

  it('edits the code via the textarea', () => {
    const { store } = renderPanel();
    fireEvent.change(screen.getByLabelText('Arduino sketch'), { target: { value: 'void loop() {}' } });
    expect(store.getState().editor.code).toBe('void loop() {}');
  });

  it('inserts two spaces and keeps the cursor position on Tab', () => {
    const { store } = renderPanel({ code: 'ab' });
    const textarea = screen.getByLabelText('Arduino sketch');
    textarea.setSelectionRange(1, 1);
    fireEvent.keyDown(textarea, { key: 'Tab' });
    expect(store.getState().editor.code).toBe('a  b');
  });

  it('loads an example sketch and switches to the code tab', () => {
    const { store } = renderPanel({ activeTab: 'serial' });
    fireEvent.change(screen.getByLabelText('Load an example sketch'), { target: { value: '0' } });
    expect(store.getState().editor.code).toBe(EXAMPLES[0].code);
    expect(store.getState().editor.activeTab).toBe('code');
  });

  it('toggles the collapsed state via the grab handle', () => {
    const { store } = renderPanel();
    expect(store.getState().editor.sheetCollapsed).toBe(false);
    fireEvent.click(screen.getByLabelText('Collapse or expand the panel'));
    expect(store.getState().editor.sheetCollapsed).toBe(true);
  });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils';
import Modal, { registerModal } from './Modal';
import { openModal } from '@/features/ui/uiSlice';

function Probe({ label = 'probe', close }) {
  return (
    <div>
      <input placeholder="focus me" />
      <span>{label} body</span>
      <button onClick={close}>close-from-body</button>
    </div>
  );
}

function open(store, props = {}) {
  act(() => {
    store.dispatch(openModal({ type: 'probe', props }));
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe('Modal', () => {
  it('renders nothing when no modal is open', () => {
    const { container } = renderWithProviders(<Modal />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for an unregistered modal type', () => {
    const { store, container } = renderWithProviders(<Modal />);
    act(() => {
      store.dispatch(openModal({ type: 'totally-unregistered' }));
    });
    expect(container.querySelector('.modal-back')).not.toBeInTheDocument();
  });

  it('renders the registered component with its props and a working close()', () => {
    registerModal('probe', Probe);
    const { store } = renderWithProviders(<Modal />);
    open(store, { label: 'hello' });
    expect(screen.getByText('hello body')).toBeInTheDocument();

    fireEvent.click(screen.getByText('close-from-body'));
    expect(screen.queryByText('hello body')).not.toBeInTheDocument();
  });

  it('closes when clicking the backdrop but not when clicking inside the dialog', () => {
    registerModal('probe', Probe);
    const { store, container } = renderWithProviders(<Modal />);
    open(store);
    expect(screen.getByText('probe body')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByText('probe body'));
    expect(screen.getByText('probe body')).toBeInTheDocument();

    fireEvent.mouseDown(container.querySelector('.modal-back'));
    expect(screen.queryByText('probe body')).not.toBeInTheDocument();
  });

  it('closes on Escape while a modal is open', () => {
    registerModal('probe', Probe);
    const { store } = renderWithProviders(<Modal />);
    open(store);
    expect(screen.getByText('probe body')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('probe body')).not.toBeInTheDocument();
  });

  it('autofocuses the first focusable element shortly after opening', async () => {
    registerModal('probe', Probe);
    const { store } = renderWithProviders(<Modal />);
    open(store);
    await waitFor(() => expect(screen.getByPlaceholderText('focus me')).toHaveFocus(), { timeout: 200 });
  });
});

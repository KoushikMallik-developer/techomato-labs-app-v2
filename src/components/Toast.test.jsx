import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils';
import Toast from './Toast';
import { showToast } from '@/features/ui/uiSlice';

afterEach(() => {
  vi.useRealTimers();
});

describe('Toast', () => {
  it('renders nothing when there is no active toast', () => {
    const { container } = renderWithProviders(<Toast />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the toast message once one is dispatched', () => {
    const { store } = renderWithProviders(<Toast />);
    act(() => {
      store.dispatch(showToast('Saved.'));
    });
    expect(screen.getByRole('status')).toHaveTextContent('Saved.');
  });

  it('auto-dismisses after its timeout', () => {
    vi.useFakeTimers();
    const { store } = renderWithProviders(<Toast />);
    act(() => {
      store.dispatch(showToast('Saved.'));
    });
    expect(screen.getByRole('status')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2600);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

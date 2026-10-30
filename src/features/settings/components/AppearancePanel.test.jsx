import { describe, it, expect } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils';
import AppearancePanel from './AppearancePanel';
import { selectThemeMode } from '@/features/theme/themeSlice';

describe('AppearancePanel', () => {
  it('highlights "System" by default', () => {
    renderWithProviders(<AppearancePanel />);
    expect(screen.getByText('System').className).toContain('on');
  });

  it('switches to dark/light and updates the store', () => {
    const { store } = renderWithProviders(<AppearancePanel />);
    fireEvent.click(screen.getByText('Dark'));
    expect(selectThemeMode(store.getState())).toBe('dark');
    expect(screen.getByText('Dark').className).toContain('on');
    expect(screen.getByText('System').className).not.toContain('on');

    fireEvent.click(screen.getByText('Light'));
    expect(selectThemeMode(store.getState())).toBe('light');
  });

  it('sets the data-theme attribute on the document element', () => {
    renderWithProviders(<AppearancePanel />);
    fireEvent.click(screen.getByText('Dark'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    fireEvent.click(screen.getByText('System'));
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
  });
});

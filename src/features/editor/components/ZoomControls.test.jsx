import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ZoomControls from './ZoomControls';

describe('ZoomControls', () => {
  it('calls the right handler for each button', () => {
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();
    const onFit = vi.fn();
    render(<ZoomControls onZoomIn={onZoomIn} onZoomOut={onZoomOut} onFit={onFit} />);

    fireEvent.click(screen.getByLabelText('Zoom in'));
    expect(onZoomIn).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText('Zoom out'));
    expect(onZoomOut).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText('Fit circuit'));
    expect(onFit).toHaveBeenCalledTimes(1);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PartsDock from './PartsDock';
import { PALETTE } from '../engine/constants';

describe('PartsDock', () => {
  it('renders a chip for every part in the palette', () => {
    render(<PartsDock running={false} onAdd={() => {}} />);
    PALETTE.forEach(([, label]) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it('calls onAdd with the part type when a chip is clicked', () => {
    const onAdd = vi.fn();
    render(<PartsDock running={false} onAdd={onAdd} />);
    const [type, label] = PALETTE[0];
    fireEvent.click(screen.getByText(label));
    expect(onAdd).toHaveBeenCalledWith(type);
  });

  it('disables every chip while the sketch is running', () => {
    render(<PartsDock running onAdd={() => {}} />);
    PALETTE.forEach(([, label]) => {
      expect(screen.getByText(label).closest('button')).toBeDisabled();
    });
  });
});

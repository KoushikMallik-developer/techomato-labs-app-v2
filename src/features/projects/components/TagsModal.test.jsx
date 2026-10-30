import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils';
import { api } from '@/lib/api';
import TagsModal from './TagsModal';

vi.mock('@/lib/api', () => ({
  api: { save: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TagsModal', () => {
  it('pre-selects the project\'s existing tags', () => {
    renderWithProviders(<TagsModal project={{ id: 'p-1', tags: ['beginner'] }} close={() => {}} />);
    expect(screen.getByText('beginner').className).toContain('on');
  });

  it('toggles a tag on and off', () => {
    renderWithProviders(<TagsModal project={{ id: 'p-1', tags: [] }} close={() => {}} />);
    const chip = screen.getByText('beginner');
    fireEvent.click(chip);
    expect(chip.className).toContain('on');
    fireEvent.click(chip);
    expect(chip.className).not.toContain('on');
  });

  it('saves the selected tags and closes', async () => {
    api.save.mockResolvedValue({ id: 'p-1', tags: ['beginner'] });
    const close = vi.fn();
    renderWithProviders(<TagsModal project={{ id: 'p-1', tags: [] }} close={close} />);
    fireEvent.click(screen.getByText('beginner'));
    fireEvent.click(screen.getByText('Save tags'));
    expect(close).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(api.save).toHaveBeenCalledWith('p-1', { tags: ['beginner'] }));
  });

  it('does not write when the tags are unchanged, but still closes', () => {
    const close = vi.fn();
    renderWithProviders(<TagsModal project={{ id: 'p-1', tags: ['beginner'] }} close={close} />);
    fireEvent.click(screen.getByText('Save tags'));
    expect(api.save).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('calls close() on Cancel without saving', () => {
    const close = vi.fn();
    renderWithProviders(<TagsModal project={{ id: 'p-1', tags: [] }} close={close} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(close).toHaveBeenCalledTimes(1);
    expect(api.save).not.toHaveBeenCalled();
  });
});

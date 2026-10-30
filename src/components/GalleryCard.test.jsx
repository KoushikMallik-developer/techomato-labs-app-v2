import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils';
import GalleryCard from './GalleryCard';
import { selectModal } from '@/features/ui/uiSlice';

const item = {
  id: 'g-1',
  name: 'Garage Parking Sensor',
  author: 'hana_builds',
  parts: [],
  wires: [],
  tags: ['sensors'],
  publishedAt: Date.now() - 2 * 86400_000,
  likeCount: 12,
};

describe('GalleryCard', () => {
  it('links the thumbnail and name to the community detail route', () => {
    renderWithProviders(<GalleryCard item={item} liked={false} onLike={() => {}} />);
    expect(screen.getByText('Garage Parking Sensor')).toHaveAttribute('href', '/community/g-1');
  });

  it('shows the author handle and a relative time', () => {
    renderWithProviders(<GalleryCard item={item} liked={false} onLike={() => {}} />);
    expect(screen.getByText('@hana_builds')).toBeInTheDocument();
    expect(screen.getByText(/2d ago/)).toBeInTheDocument();
  });

  it('opens the author modal when the handle is clicked', () => {
    const { store } = renderWithProviders(<GalleryCard item={item} liked={false} onLike={() => {}} />);
    fireEvent.click(screen.getByText('@hana_builds'));
    expect(selectModal(store.getState())).toEqual({ type: 'author', props: { handle: 'hana_builds' } });
  });

  it('renders tags when present', () => {
    renderWithProviders(<GalleryCard item={item} liked={false} onLike={() => {}} />);
    expect(screen.getByText('sensors')).toBeInTheDocument();
  });

  it('shows the like count and highlights when liked', () => {
    const { rerender, container } = renderWithProviders(<GalleryCard item={item} liked={false} onLike={() => {}} />);
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(container.querySelector('.like').className).not.toContain('on');
  });

  it('calls onLike with the item id when the like button is clicked', () => {
    const onLike = vi.fn();
    renderWithProviders(<GalleryCard item={item} liked={false} onLike={onLike} />);
    fireEvent.click(screen.getByText('12').closest('button'));
    expect(onLike).toHaveBeenCalledWith('g-1');
  });

  it('defaults the like count to 0 when missing', () => {
    renderWithProviders(<GalleryCard item={{ ...item, likeCount: undefined }} liked={false} onLike={() => {}} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});

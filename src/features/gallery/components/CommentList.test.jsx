import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders, authState, signedInUser } from '@/test-utils';
import { api } from '@/lib/api';
import CommentList from './CommentList';

vi.mock('@/lib/api', () => ({
  api: { deleteComment: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const comments = [
  { id: 'c-1', userId: 'u-1', name: 'Ada', text: 'Nice build', createdAt: Date.now() - 3600_000 },
  { id: 'c-2', userId: 'u-2', name: 'Grace', text: 'Love the wiring', createdAt: Date.now() - 60_000 },
];

describe('CommentList', () => {
  it('shows a placeholder when there are no comments', () => {
    renderWithProviders(<CommentList itemId="g-1" comments={[]} />);
    expect(screen.getByText('No comments yet.')).toBeInTheDocument();
  });

  it('renders every comment with author and relative time', () => {
    renderWithProviders(<CommentList itemId="g-1" comments={comments} />);
    expect(screen.getByText('Ada')).toBeInTheDocument();
    expect(screen.getByText('Nice build')).toBeInTheDocument();
    expect(screen.getByText('Grace')).toBeInTheDocument();
    expect(screen.getByText('Love the wiring')).toBeInTheDocument();
  });

  it('shows a delete button only on the signed-in user\'s own comment', () => {
    renderWithProviders(<CommentList itemId="g-1" comments={comments} />, {
      preloadedState: { auth: authState({ user: signedInUser({ id: 'u-1' }) }) },
    });
    expect(screen.getAllByLabelText('Delete comment')).toHaveLength(1);
  });

  it('shows no delete buttons when signed out', () => {
    renderWithProviders(<CommentList itemId="g-1" comments={comments} />);
    expect(screen.queryAllByLabelText('Delete comment')).toHaveLength(0);
  });

  it('deletes the comment when the delete button is clicked', () => {
    api.deleteComment.mockResolvedValue(undefined);
    renderWithProviders(<CommentList itemId="g-1" comments={comments} />, {
      preloadedState: { auth: authState({ user: signedInUser({ id: 'u-1' }) }) },
    });
    fireEvent.click(screen.getByLabelText('Delete comment'));
    expect(api.deleteComment).toHaveBeenCalledWith('g-1', 'c-1');
  });
});

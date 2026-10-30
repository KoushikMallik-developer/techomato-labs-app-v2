import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders, authState, signedInUser } from '@/test-utils';
import { api } from '@/lib/api';
import CommentForm from './CommentForm';

vi.mock('@/lib/api', () => ({
  api: { addComment: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CommentForm (signed out)', () => {
  it('shows a log-in prompt linking back to this item, instead of the form', () => {
    renderWithProviders(<CommentForm itemId="g-1" />);
    const link = screen.getByText('Log in');
    expect(link).toHaveAttribute('href', `/login?next=${encodeURIComponent('/community/g-1')}`);
    expect(screen.queryByPlaceholderText('Add a comment…')).not.toBeInTheDocument();
  });
});

describe('CommentForm (signed in)', () => {
  const preloadedState = { auth: authState({ user: signedInUser() }) };

  it('posts a trimmed comment and clears the input', async () => {
    api.addComment.mockResolvedValue({ id: 'c-1', name: 'Ada', text: 'Nice build', createdAt: Date.now() });
    renderWithProviders(<CommentForm itemId="g-1" />, { preloadedState });
    const input = screen.getByPlaceholderText('Add a comment…');
    fireEvent.change(input, { target: { value: '  Nice build  ' } });
    fireEvent.click(screen.getByText('Post'));
    expect(api.addComment).toHaveBeenCalledWith('g-1', 'Nice build');
    expect(input).toHaveValue('');
  });

  it('does not submit a blank/whitespace-only comment', () => {
    renderWithProviders(<CommentForm itemId="g-1" />, { preloadedState });
    fireEvent.change(screen.getByPlaceholderText('Add a comment…'), { target: { value: '   ' } });
    fireEvent.click(screen.getByText('Post'));
    expect(api.addComment).not.toHaveBeenCalled();
  });
});

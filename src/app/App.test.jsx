import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { store } from './store';
import App from './App';

describe('App', () => {
  it('renders the landing page by default', async () => {
    render(
      <Provider store={store}>
        <App />
      </Provider>,
    );
    expect((await screen.findAllByText(/Techomato Labs/i)).length).toBeGreaterThan(0);
  });
});

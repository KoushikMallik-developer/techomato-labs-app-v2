import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from '@/app/store';
import App from '@/app/App';
import ErrorBoundary from '@/components/ErrorBoundary';
import { registerAllModals } from '@/app/registerModals';
import '@/styles/theme.css';
import '@/styles/global.css';
import '@/styles/pages.css';
import '@/styles/editor.css';

registerAllModals();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <Provider store={store}>
        <App />
      </Provider>
    </ErrorBoundary>
  </StrictMode>,
);

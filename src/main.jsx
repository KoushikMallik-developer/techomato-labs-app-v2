import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from '@/app/store';
import App from '@/app/App';
import { registerAllModals } from '@/app/registerModals';
import '@/styles/theme.css';
import '@/styles/global.css';
import '@/styles/pages.css';
import '@/styles/editor.css';

registerAllModals();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
);

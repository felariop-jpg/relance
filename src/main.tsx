import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import i18n from './i18n';
import './index.css';
import { App } from './App';
import { ensureSettings } from './db/settings';
import { StorageUnavailable } from './screens/StorageUnavailable';

const root = createRoot(document.getElementById('root')!);

ensureSettings().then(
  () =>
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  (error: unknown) => {
    console.error(error);
    root.render(<StorageUnavailable i18n={i18n} />);
  },
);

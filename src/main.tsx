import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import i18n from './i18n';
import './index.css';
import { App } from './App';
import { ensureSettings } from './db/settings';
import { ensureTemplatesSeeded } from './db/templates';
import { markInterruptedDrafts } from './db/drafts';
import { StorageUnavailable } from './screens/StorageUnavailable';

const root = createRoot(document.getElementById('root')!);

async function start() {
  await ensureSettings();
  await ensureTemplatesSeeded();
  await markInterruptedDrafts();
}

start().then(
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

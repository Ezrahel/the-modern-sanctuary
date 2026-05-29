import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';
import { initPostHog } from './posthog.ts';
import { initGA4 } from './lib/analytics/ga4.ts';
import { tracker } from './lib/analytics/tracker.ts';

initPostHog();
initGA4();
tracker.init();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

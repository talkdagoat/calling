import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Temporary test mode: account names and test data must not survive the browser session.
const TEMPORARY_KEYS = [
  'talk_account_user_name',
  'talk_user_identity',
  'talk_user_contacts',
  'talk_call_history',
  'talk_app_settings',
];

const clearTemporarySession = () => {
  try {
    for (const key of TEMPORARY_KEYS) localStorage.removeItem(key);
    for (const key of TEMPORARY_KEYS) sessionStorage.removeItem(key);
  } catch {}
};

window.addEventListener('pagehide', clearTemporarySession, { capture: true });
window.addEventListener('beforeunload', clearTemporarySession, { capture: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

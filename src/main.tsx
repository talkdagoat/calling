import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import TemporaryApp from './TemporaryApp.tsx';
import './index.css';

// Temporary test mode: names and session data are intentionally removed when the page exits.
const TEMPORARY_KEYS = [
  'talk_temp_identity',
  'talk_account_user_name',
  'talk_user_identity',
  'talk_user_contacts',
  'talk_call_history',
  'talk_app_settings',
];

const clearTemporarySession = () => {
  try {
    for (const key of TEMPORARY_KEYS) {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }
  } catch {}
};

window.addEventListener('pagehide', clearTemporarySession, { capture: true });
window.addEventListener('beforeunload', clearTemporarySession, { capture: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TemporaryApp />
  </StrictMode>,
);

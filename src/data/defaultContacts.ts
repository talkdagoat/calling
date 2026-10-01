import { Contact, UserIdentity } from '../types';

export const INITIAL_CONTACTS_JSON: Contact[] = [];

export const STORAGE_KEY_USER_NAME = 'talk_account_user_name';
export const STORAGE_KEY_CONTACTS = 'talk_user_contacts';
export const STORAGE_KEY_IDENTITY = 'talk_user_identity';
export const STORAGE_KEY_CALL_LOGS = 'talk_call_history';
export const STORAGE_KEY_SETTINGS = 'talk_app_settings';

// Test mode: browser session storage is temporary and disappears when the tab/session ends.
export function loadSavedContacts(): Contact[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_CONTACTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to load temporary contacts', e);
  }
  return [];
}

export function saveContactsToStorage(contacts: Contact[]): void {
  try {
    sessionStorage.setItem(STORAGE_KEY_CONTACTS, JSON.stringify(contacts));
  } catch (e) {
    console.error('Failed to save temporary contacts', e);
  }
}

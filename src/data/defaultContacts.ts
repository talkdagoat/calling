import { Contact } from '../types';

export const INITIAL_CONTACTS_JSON: Contact[] = [];

export const STORAGE_KEY_CONTACTS = 'talk_user_contacts';
export const STORAGE_KEY_IDENTITY = 'talk_user_identity';
export const STORAGE_KEY_CALL_LOGS = 'talk_call_history';
export const STORAGE_KEY_SETTINGS = 'talk_app_settings';

export function loadSavedContacts(): Contact[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONTACTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load contacts from localStorage', e);
  }
  return [];
}

export function saveContactsToStorage(contacts: Contact[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_CONTACTS, JSON.stringify(contacts));
  } catch (e) {
    console.error('Failed to save contacts', e);
  }
}


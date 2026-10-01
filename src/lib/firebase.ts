// Temporary account directory compatibility layer.
// Firebase has been removed from the runtime and dependencies. Account names
// are temporary: the active identity is kept in browser state only while the
// page is open, and the identity keys are cleared when the page is exited.

export interface TemporaryUser {
  id: string;
  name: string;
  avatar: string;
  publicKeyFingerprint: string;
  status: 'online' | 'offline';
  lastActive: string;
  createdAt: string;
}

const TEMP_KEYS = [
  'talk_account_user_name',
  'talk_user_identity',
  'talk_user_contacts',
  'talk_call_history',
  'talk_app_settings',
];

if (typeof window !== 'undefined') {
  const clearTemporaryAccount = () => {
    try {
      for (const key of TEMP_KEYS) localStorage.removeItem(key);
    } catch {}
  };

  // A browser refresh/close/navigation is the end of a temporary test session.
  window.addEventListener('pagehide', clearTemporaryAccount, { capture: true });
  window.addEventListener('beforeunload', clearTemporaryAccount, { capture: true });
}

export async function testFirestoreConnection(): Promise<boolean> {
  return true;
}

export async function registerUserInFirestore(user: {
  id: string;
  name: string;
  avatar: string;
  publicKeyFingerprint?: string;
}): Promise<TemporaryUser> {
  const now = new Date().toISOString();
  return {
    id: user.id,
    name: user.name.trim(),
    avatar: user.avatar || '',
    publicKeyFingerprint: user.publicKeyFingerprint || '',
    status: 'online',
    lastActive: now,
    createdAt: now,
  };
}

export async function findTalkUserByName(_name: string): Promise<TemporaryUser | null> {
  return null;
}

export async function addContactToFirestore(): Promise<{ success: false; error: string }> {
  return { success: false, error: 'Persistent contacts are disabled in temporary mode.' };
}

export function subscribeToRegisteredUsers(_callback: (users: TemporaryUser[]) => void): () => void {
  return () => undefined;
}

export function subscribeToUserContacts(_ownerId: string, _callback: (contacts: unknown[]) => void): () => void {
  return () => undefined;
}

export async function deleteContactFromFirestore(): Promise<boolean> {
  return false;
}

// Temporary account directory compatibility layer.
// Firebase has been removed from the app. This file keeps the existing
// component imports working while account names live only in the current
// browser/session and the WebSocket server's in-memory connection map.

export interface TemporaryUser {
  id: string;
  name: string;
  avatar: string;
  publicKeyFingerprint: string;
  status: 'online' | 'offline';
  lastActive: string;
  createdAt: string;
}

export async function testFirestoreConnection(): Promise<boolean> {
  // Kept for compatibility with the existing startup code. There is no
  // database connection anymore.
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

export async function findTalkUserByName(name: string): Promise<TemporaryUser | null> {
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

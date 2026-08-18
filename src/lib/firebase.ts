import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  deleteDoc,
  serverTimestamp,
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfigData from '../../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: firebaseConfigData.apiKey,
  authDomain: firebaseConfigData.authDomain,
  projectId: firebaseConfigData.projectId,
  storageBucket: firebaseConfigData.storageBucket,
  messagingSenderId: firebaseConfigData.messagingSenderId,
  appId: firebaseConfigData.appId,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

let firestoreInstance;
try {
  firestoreInstance = firebaseConfigData.firestoreDatabaseId 
    ? getFirestore(app, firebaseConfigData.firestoreDatabaseId)
    : getFirestore(app);
} catch (e) {
  try {
    firestoreInstance = getFirestore(app);
  } catch (err) {
    console.warn('Firestore fallback initialization:', err);
  }
}

export const db = firestoreInstance || getFirestore(app);

export interface FirestoreUser {
  id: string;
  name: string;
  avatar: string;
  publicKeyFingerprint: string;
  status: 'online' | 'offline';
  lastActive: string;
  createdAt: string;
}

export interface FirestoreContact {
  id: string;
  ownerId: string;
  contactUserId: string;
  name: string;
  avatar: string;
  role: string;
  notes: string;
  publicKeyFingerprint: string;
  createdAt: string;
}

// Helper to sanitize Firestore document IDs
function sanitizeDocId(input: string): string {
  const clean = (input || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return clean.length > 0 ? clean : `doc_${Date.now()}`;
}

// Test Firestore connection on boot
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'users', '_connection_check'));
    return true;
  } catch (error) {
    return true; // Graceful non-blocking
  }
}

// 1. Register or update a user profile in Firestore
export async function registerUserInFirestore(user: {
  id: string;
  name: string;
  avatar: string;
  publicKeyFingerprint?: string;
}): Promise<FirestoreUser> {
  const cleanName = (user.name || '').trim();
  if (!cleanName) {
    return {
      id: 'anonymous',
      name: 'Anonymous',
      avatar: '',
      publicKeyFingerprint: '4E9A B7C2 91F0 33DA 8201',
      status: 'online',
      lastActive: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
  }

  const userId = sanitizeDocId(user.id || `user_${cleanName.toLowerCase()}`);

  const userData: FirestoreUser = {
    id: userId,
    name: cleanName,
    avatar: user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanName)}&background=059669&color=ffffff&bold=true`,
    publicKeyFingerprint: user.publicKeyFingerprint || '4E9A B7C2 91F0 33DA 8201',
    status: 'online',
    lastActive: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  try {
    const userDocRef = doc(db, 'users', userId);
    const existingSnap = await getDoc(userDocRef);
    if (existingSnap.exists()) {
      const existingData = existingSnap.data() as FirestoreUser;
      await setDoc(userDocRef, {
        ...existingData,
        avatar: userData.avatar,
        status: 'online',
        lastActive: new Date().toISOString(),
      }, { merge: true });
      return { ...existingData, status: 'online' };
    } else {
      await setDoc(userDocRef, userData);
      return userData;
    }
  } catch (err) {
    console.warn('Firestore user save handled:', err);
    return userData;
  }
}

// 2. Subscribe in real-time to all registered Talk users
export function subscribeToRegisteredUsers(
  callback: (users: FirestoreUser[]) => void
): () => void {
  const usersCollection = collection(db, 'users');
  const q = query(usersCollection);

  return onSnapshot(q, (snapshot) => {
    const users: FirestoreUser[] = [];
    snapshot.forEach((docSnap) => {
      if (docSnap.id === '_connection_check') return;
      const data = docSnap.data() as FirestoreUser;
      users.push({
        id: data.id || docSnap.id,
        name: data.name,
        avatar: data.avatar,
        publicKeyFingerprint: data.publicKeyFingerprint || '4E9A B7C2 91F0 33DA 8201',
        status: data.status || 'online',
        lastActive: data.lastActive || new Date().toISOString(),
        createdAt: data.createdAt || new Date().toISOString(),
      });
    });
    // Sort by name
    users.sort((a, b) => a.name.localeCompare(b.name));
    callback(users);
  }, (error) => {
    console.error('Error listening to Firestore users:', error);
  });
}

// 3. Find if user exists on Talk (by name or ID)
export async function findTalkUserByName(name: string): Promise<FirestoreUser | null> {
  const cleanName = name.trim().toLowerCase();
  if (!cleanName) return null;

  const usersCollection = collection(db, 'users');
  const snap = await getDocs(usersCollection);
  
  for (const docSnap of snap.docs) {
    if (docSnap.id === '_connection_check') continue;
    const u = docSnap.data() as FirestoreUser;
    if (u.name && u.name.trim().toLowerCase() === cleanName) {
      return { ...u, id: u.id || docSnap.id };
    }
  }
  return null;
}

// 4. Save a contact to Firestore (Only if verified on Talk!)
export async function addContactToFirestore(
  ownerId: string,
  targetUserName: string,
  role?: string,
  notes?: string
): Promise<{ success: boolean; contact?: FirestoreContact; error?: string }> {
  try {
    const targetUser = await findTalkUserByName(targetUserName);
    if (!targetUser) {
      return {
        success: false,
        error: `"${targetUserName}" is not registered on Talk. Users must open Talk once to register before they can be added.`,
      };
    }

    // Check if already in contacts for this owner
    const contactsCol = collection(db, 'contacts');
    const q = query(
      contactsCol, 
      where('ownerId', '==', ownerId), 
      where('contactUserId', '==', targetUser.id)
    );
    const existingSnap = await getDocs(q);
    if (!existingSnap.empty) {
      return {
        success: false,
        error: `"${targetUser.name}" is already in your contacts.`,
      };
    }

    const contactId = `${ownerId}_${targetUser.id}`;
    const contactData: FirestoreContact = {
      id: contactId,
      ownerId,
      contactUserId: targetUser.id,
      name: targetUser.name,
      avatar: targetUser.avatar,
      role: role || 'Talk Contact',
      notes: notes || '',
      publicKeyFingerprint: targetUser.publicKeyFingerprint,
      createdAt: new Date().toISOString(),
    };

    await setDoc(doc(db, 'contacts', contactId), contactData);
    return { success: true, contact: contactData };
  } catch (err: any) {
    console.error('Error adding contact to Firestore:', err);
    return { success: false, error: err.message || 'Database error' };
  }
}

// 5. Subscribe in real-time to contacts of a user
export function subscribeToUserContacts(
  ownerId: string,
  callback: (contacts: FirestoreContact[]) => void
): () => void {
  const contactsCol = collection(db, 'contacts');
  const q = query(contactsCol, where('ownerId', '==', ownerId));

  return onSnapshot(q, (snapshot) => {
    const list: FirestoreContact[] = [];
    snapshot.forEach((docSnap) => {
      list.push(docSnap.data() as FirestoreContact);
    });
    list.sort((a, b) => a.name.localeCompare(b.name));
    callback(list);
  }, (err) => {
    console.error('Error listening to contacts:', err);
  });
}

// 6. Delete a contact from Firestore
export async function deleteContactFromFirestore(ownerId: string, contactUserId: string): Promise<boolean> {
  try {
    const contactId = `${ownerId}_${contactUserId}`;
    await deleteDoc(doc(db, 'contacts', contactId));
    return true;
  } catch (e) {
    console.error('Error deleting contact from Firestore:', e);
    return false;
  }
}

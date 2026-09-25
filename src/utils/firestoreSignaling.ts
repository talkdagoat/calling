import { collection, addDoc, onSnapshot, query, orderBy, limit, type Unsubscribe } from 'firebase/firestore';
import { db } from '../lib/firebase';

export type SignalingEvent = {
  id?: string;
  type: string;
  sender: any;
  targetUserId?: string;
  targetUserName?: string;
  callId?: string;
  roomId?: string;
  callType?: string;
  payload?: any;
  timestamp: number;
};

function inboxFor(userId: string) {
  return collection(db, 'callSignals', userId, 'events');
}

export async function sendSignalingEvent(targetUserId: string, event: Omit<SignalingEvent, 'id'>) {
  if (!targetUserId) return;
  await addDoc(inboxFor(targetUserId), {
    ...event,
    timestamp: event.timestamp || Date.now(),
  });
}

export function subscribeToSignaling(
  userId: string,
  onEvent: (event: SignalingEvent) => void,
): Unsubscribe {
  if (!userId) return () => undefined;

  const q = query(inboxFor(userId), orderBy('timestamp', 'desc'), limit(100));
  let initialSnapshot = true;
  const seen = new Set<string>();

  return onSnapshot(q, snapshot => {
    const added = snapshot.docChanges().filter(change => change.type === 'added');
    if (initialSnapshot) {
      initialSnapshot = false;
      const now = Date.now();
      for (const change of added) {
        seen.add(change.doc.id);
        const data = change.doc.data() as SignalingEvent;
        // Only replay very recent signals after a page reload.
        if (now - Number(data.timestamp || 0) <= 60000) {
          onEvent({ ...data, id: change.doc.id });
        }
      }
      return;
    }

    for (const change of added) {
      if (seen.has(change.doc.id)) continue;
      seen.add(change.doc.id);
      onEvent({ ...(change.doc.data() as SignalingEvent), id: change.doc.id });
    }
  }, error => {
    console.error('[Signaling] Firestore listener error:', error);
  });
}

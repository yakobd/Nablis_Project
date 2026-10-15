import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from './config';
import { auth } from './auth-native';

export interface NotifyInput {
  userId: string;
  /** e.g. appointment_confirmed, message, blog, event, new_registration */
  type: string;
  title: string;
  description: string;
  /** Web path to open, e.g. /appointment */
  link?: string;
}

// Where the push-sending API lives. Relative on web; mobile sets the absolute
// URL of the deployed web app at startup.
let pushEndpoint = '/api/push';
export function setPushEndpoint(url: string) {
  pushEndpoint = url;
}

/**
 * Creates in-app notifications and asks the server to deliver them as push
 * notifications. Push is best-effort: in-app notifications are saved even if
 * the push request fails.
 */
export async function notify(items: NotifyInput | NotifyInput[]): Promise<void> {
  const list = Array.isArray(items) ? items : [items];
  const me = auth.currentUser;
  if (!me || list.length === 0) return;

  const ids: string[] = [];
  // Firestore batches are capped at 500 writes.
  for (let i = 0; i < list.length; i += 450) {
    const batch = writeBatch(db);
    for (const item of list.slice(i, i + 450)) {
      const ref = doc(collection(db, 'notifications'));
      ids.push(ref.id);
      batch.set(ref, {
        ...item,
        link: item.link ?? null,
        read: false,
        createdBy: me.uid,
        createdAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }

  try {
    const token = await me.getIdToken();
    await fetch(pushEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ids }),
    });
  } catch {
    // Push delivery is optional; the in-app notification already exists.
  }
}

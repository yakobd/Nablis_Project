import 'server-only';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Server-side Firebase (bypasses security rules). Needs FIREBASE_ADMIN_* env vars;
// returns null when they are not configured so callers can degrade gracefully.
export function getAdmin() {
  if (!getApps().length) {
    const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey  = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (!projectId || !clientEmail || !privateKey) return null;
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  return { auth: getAuth(), db: getFirestore() };
}

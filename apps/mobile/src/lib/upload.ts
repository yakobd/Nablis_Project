import { auth } from './firebase';

// Base URL of the deployed web app, which hosts the authenticated /api routes.
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');

// Uploads a local image (from expo-image-picker) through the web app's
// /api/upload route, which checks the caller's Firebase ID token.
export async function uploadImage(uri: string, folder: string): Promise<string> {
  if (!API_URL) throw new Error('EXPO_PUBLIC_API_URL is not configured');
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not signed in');

  const name = uri.split('/').pop() || 'upload.jpg';
  const body = new FormData();
  body.append('file', { uri, name, type: 'image/jpeg' } as unknown as Blob);
  body.append('folder', folder);

  const res = await fetch(`${API_URL}/api/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    // DOM and React Native ship conflicting FormData typings.
    body: body as unknown as RequestInit['body'],
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  const data = (await res.json()) as { url: string };
  return data.url;
}

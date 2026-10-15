import { auth } from '@/lib/firebase';

export async function uploadToCloudinary(file: File, folder: string): Promise<string> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Upload failed: not signed in');

  const body = new FormData();
  body.append('file', file);
  body.append('folder', folder);

  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed: ${text}`);
  }
  const { url } = (await res.json()) as { url: string };
  return url;
}

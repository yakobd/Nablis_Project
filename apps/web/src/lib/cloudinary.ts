export async function uploadToCloudinary(file: File, folder: string): Promise<string> {
  const body = new FormData();
  body.append('file', file);
  body.append('folder', folder);

  const res = await fetch('/api/upload', { method: 'POST', body });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed: ${text}`);
  }
  const { url } = (await res.json()) as { url: string };
  return url;
}

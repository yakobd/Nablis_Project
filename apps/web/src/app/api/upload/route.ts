import { v2 as cloudinary } from 'cloudinary';
import { NextRequest, NextResponse } from 'next/server';

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MAX_BYTES = 25 * 1024 * 1024;
const FOLDER_RE = /^nablis(\/[a-z0-9-]+)*$/;

// Confirms the bearer token is a live Firebase ID token for this project.
// Uses the Identity Toolkit REST API so no service-account credentials are needed.
async function isSignedIn(req: NextRequest): Promise<boolean> {
  const idToken = req.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!idToken) return false;

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    }
  );
  if (!res.ok) return false;
  const data = (await res.json()) as { users?: unknown[] };
  return !!data.users?.length;
}

export async function POST(req: NextRequest) {
  if (!(await isSignedIn(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const form   = await req.formData();
  const file   = form.get('file') as File | null;
  const folder = (form.get('folder') as string | null) ?? 'nablis';

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large (max 25 MB)' }, { status: 413 });
  }
  if (!FOLDER_RE.test(folder)) {
    return NextResponse.json({ error: 'Invalid folder' }, { status: 400 });
  }

  const bytes  = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder, resource_type: 'auto' }, (error, res) => {
        if (error || !res) reject(error ?? new Error('Upload failed'));
        else resolve(res as { secure_url: string });
      })
      .end(buffer);
  });

  return NextResponse.json({ url: result.secure_url });
}

import { redirect } from 'next/navigation';

// Member management lives in Settings (see the design).
export default function Page() { redirect('/settings/members'); }

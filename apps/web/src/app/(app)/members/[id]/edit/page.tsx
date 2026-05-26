import { redirect } from 'next/navigation';
export default function Page({ params }: { params: { id: string } }) {
  redirect(`/settings/members/${params.id}/edit`);
}

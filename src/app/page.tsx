import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { landingPath } from '@/lib/landing';

export default async function RootPage() {
  const user = await getSessionUser();
  // Odredište ovisi o pravima: blagajnik ide na blagajnu, ne na nadzornu ploču.
  redirect(user ? landingPath(user.permissions) : '/login');
}

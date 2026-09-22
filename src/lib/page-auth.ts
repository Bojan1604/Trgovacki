import 'server-only';
import { redirect } from 'next/navigation';
import { requireUser, type SessionUser } from './auth';
import { hasPermission } from './permissions';
import { landingPath, NO_ACCESS_PATH } from './landing';

/**
 * Provjera prava pri prikazu stranice.
 *
 * Razlika od `requirePermission`: u API ruti bacanje greške ima smisla jer se
 * pretvara u status 403, ali u prikazu stranice ista greška sruši sučelje i
 * korisnik dobije stranicu s greškom umjesto aplikacije. Ovdje ga zato šaljemo
 * na prvu stranicu koju smije vidjeti.
 */
export async function requirePageAccess(permission: string): Promise<SessionUser> {
  const user = await requireUser();
  if (hasPermission(user.permissions, permission)) return user;

  const target = landingPath(user.permissions);
  // Korisnik bez ijednog odredišta — inače bi ga preusmjeravanje vrtjelo u krug.
  redirect(target === NO_ACCESS_PATH ? `${NO_ACCESS_PATH}?trazeno=${encodeURIComponent(permission)}` : target);
}

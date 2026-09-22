import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth-constants';

/**
 * Prva linija zaštite ruta.
 *
 * Provjerava samo postojanje kolačića sesije i preusmjerava neprijavljene
 * korisnike na prijavu. Stvarna provjera ovlasti radi se na poslužitelju
 * (`requirePermission`) jer middleware ne pristupa bazi — ovdje se izbjegava
 * nepotreban rad i bljeskanje praznog sučelja.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    // Nakon prijave korisnik se vraća na traženu stranicu.
    if (pathname !== '/') url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  /**
   * Zaštićeno je sve osim prijave, API ruta (koje imaju vlastitu provjeru),
   * statičkih datoteka i ikona.
   */
  matcher: [
    '/((?!login|api|_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)',
  ],
};

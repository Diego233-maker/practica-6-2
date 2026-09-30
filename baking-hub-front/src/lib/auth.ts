import type { AstroCookies } from 'astro';

export const COOKIE_SESION = 'bh_token';
const SIETE_DIAS = 60 * 60 * 24 * 7; // igual que la expiración del JWT en el backend

export function guardarSesion(cookies: AstroCookies, token: string) {
  cookies.set(COOKIE_SESION, token, {
    httpOnly: true, // el JavaScript del navegador no puede leer el token
    sameSite: 'lax',
    secure: import.meta.env.PROD, // en producción solo viaja por HTTPS
    path: '/',
    maxAge: SIETE_DIAS,
  });
}

export function cerrarSesion(cookies: AstroCookies) {
  cookies.delete(COOKIE_SESION, { path: '/' });
}

/** Evita open redirects: solo acepta rutas internas ("/algo"), nunca "//otro.com". */
export function rutaSegura(next: string | null | undefined, porDefecto = '/') {
  return next && /^\/(?![/\\])/.test(next) ? next : porDefecto;
}

import { defineMiddleware } from 'astro:middleware';
import { COOKIE_SESION, cerrarSesion } from './lib/auth';
import { graphql } from './lib/graphql';
import { ME } from './lib/queries';
import type { Usuario } from './types';

const RUTAS_PROTEGIDAS = ['/checkout', '/pedidos', '/admin'];
const RUTAS_ADMIN = ['/admin'];

const coincide = (ruta: string, base: string) => ruta === base || ruta.startsWith(`${base}/`);

export const onRequest = defineMiddleware(async ({ cookies, locals, url, redirect }, next) => {
  const token = cookies.get(COOKIE_SESION)?.value ?? null;
  locals.token = token;
  locals.usuario = null;

  if (token) {
    try {
      // El backend es quien valida el JWT; aquí solo preguntamos "¿quién soy?".
      const { me } = await graphql<{ me: Usuario | null }>(ME, {}, token);
      if (me) locals.usuario = me;
      else cerrarSesion(cookies); // token vencido o de un usuario que ya no existe
    } catch {
      // Backend caído: seguimos como visitante sin borrar la cookie.
    }
  }

  const protegida = RUTAS_PROTEGIDAS.some((r) => coincide(url.pathname, r));
  if (protegida && !locals.usuario) {
    return redirect(`/login?next=${encodeURIComponent(url.pathname)}`);
  }

  // El panel de administración es solo para admins (el backend vuelve a comprobarlo en cada operación).
  if (RUTAS_ADMIN.some((r) => coincide(url.pathname, r)) && locals.usuario?.rol !== 'admin') {
    return redirect('/');
  }

  const respuesta = await next();
  // Cabeceras básicas de endurecimiento. (No se fija una Content-Security-Policy aquí porque hay que
  // permitir los dominios de Mercado Pago; ver la guía de seguridad antes de añadirla.)
  respuesta.headers.set('X-Content-Type-Options', 'nosniff');
  respuesta.headers.set('X-Frame-Options', 'DENY');
  respuesta.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return respuesta;
});

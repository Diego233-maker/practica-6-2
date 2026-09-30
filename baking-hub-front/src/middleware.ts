import { defineMiddleware } from 'astro:middleware';
import { COOKIE_SESION, cerrarSesion } from './lib/auth';
import { graphql } from './lib/graphql';
import { ME } from './lib/queries';
import type { Usuario } from './types';

const RUTAS_PROTEGIDAS = ['/checkout', '/pedidos'];

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

  const protegida = RUTAS_PROTEGIDAS.some((r) => url.pathname === r || url.pathname.startsWith(`${r}/`));
  if (protegida && !locals.usuario) {
    return redirect(`/login?next=${encodeURIComponent(url.pathname)}`);
  }
  return next();
});

import type { APIRoute } from 'astro';
import { ApiError, graphql } from '../../lib/graphql';
import { CREAR_PEDIDO } from '../../lib/queries';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

/** Recibe { productos: ["1","1","3"] } desde la isla de checkout y crea el pedido con el token de la cookie. */
export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.usuario || !locals.token) return json({ error: 'Debes iniciar sesión para pagar.' }, 401);

  const cuerpo = await request.json().catch(() => null);
  const productos: unknown = cuerpo?.productos;
  const valido =
    Array.isArray(productos) &&
    productos.length > 0 &&
    productos.length <= 500 &&
    productos.every((id) => typeof id === 'string' && /^\d+$/.test(id));
  if (!valido) return json({ error: 'El carrito no es válido.' }, 400);

  try {
    const { crearPedido } = await graphql<{ crearPedido: unknown }>(CREAR_PEDIDO, { productos }, locals.token);
    return json({ pedido: crearPedido });
  } catch (e) {
    if (e instanceof ApiError) {
      const status = e.codigo === 'UNAUTHENTICATED' ? 401 : e.codigo === 'BAD_USER_INPUT' ? 400 : 502;
      return json({ error: e.message }, status);
    }
    return json({ error: 'Error inesperado.' }, 500);
  }
};

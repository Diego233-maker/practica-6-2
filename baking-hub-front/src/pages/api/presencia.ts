import type { APIRoute } from 'astro';
import { ApiError, graphql } from '../../lib/graphql';
import { REGISTRAR_PRESENCIA } from '../../lib/queries';

export const POST: APIRoute = async ({ locals }) => {
  if (!locals.token || !locals.usuario) return new Response('Debes iniciar sesión.', { status: 401 });
  if (locals.usuario.rol !== 'cliente') return new Response('Solo los clientes reportan presencia.', { status: 403 });

  try {
    await graphql<{ registrarPresencia: boolean }>(REGISTRAR_PRESENCIA, {}, locals.token);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof ApiError) {
      const status = error.codigo === 'UNAUTHENTICATED' ? 401 : error.codigo === 'FORBIDDEN' ? 403 : 502;
      return new Response(error.message, { status });
    }
    console.error('Error inesperado al actualizar la presencia del cliente:', error);
    return new Response('No se pudo actualizar la presencia.', { status: 500 });
  }
};

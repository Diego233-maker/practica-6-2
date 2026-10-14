import type { APIRoute } from 'astro';
import { createClient } from 'graphql-ws';
import WebSocket from 'ws';
import { GRAPHQL_WS_URL } from 'astro:env/server';
import { USUARIO_PRESENCIA_SUBSCRIPTION } from '../../../lib/queries';

export const GET: APIRoute = ({ locals, request }) => {
  if (!locals.token || locals.usuario?.rol !== 'admin') {
    return new Response('No autorizado', { status: locals.usuario ? 403 : 401 });
  }

  let cancelar = () => {};
  const stream = new ReadableStream({
    start(controller) {
      let activo = true;
      let unsubscribe = () => {};
      const enviar = (evento: string, datos = '') => {
        if (activo) controller.enqueue(new TextEncoder().encode(`event: ${evento}\ndata: ${datos}\n\n`));
      };
      const heartbeat = setInterval(() => {
        if (activo) controller.enqueue(new TextEncoder().encode(': keep-alive\n\n'));
      }, 25_000);
      const client = createClient({
        url: GRAPHQL_WS_URL,
        webSocketImpl: WebSocket,
        connectionParams: { authorization: `Bearer ${locals.token}` },
        on: {
          connected: () => enviar('conectado'),
          error: (error) => {
            console.error('Error en WebSocket de presencia de usuarios:', error);
            enviar('error', JSON.stringify({ message: 'Reconectando con el backend…' }));
          },
        },
      });
      const cerrar = (cerrarRespuesta: boolean) => {
        if (!activo) return;
        activo = false;
        clearInterval(heartbeat);
        unsubscribe();
        void client.dispose();
        if (cerrarRespuesta) controller.close();
      };
      cancelar = () => cerrar(false);
      request.signal.addEventListener('abort', () => cerrar(true), { once: true });
      unsubscribe = client.subscribe(
        { query: USUARIO_PRESENCIA_SUBSCRIPTION },
        {
          next: ({ data, errors }) => {
            if (errors?.length) {
              console.error('Error GraphQL en la suscripción de presencia:', errors);
              enviar('error', JSON.stringify({ message: 'No se pudo recibir la presencia en tiempo real.' }));
              cerrar(true);
              return;
            }
            if (data?.usuarioPresenciaActualizada) {
              enviar('presencia-usuario', JSON.stringify(data.usuarioPresenciaActualizada));
            }
          },
          error: (error) => {
            console.error('Falló la suscripción GraphQL de presencia:', error);
            enviar('error', JSON.stringify({ message: 'No se pudo recibir la presencia en tiempo real.' }));
            cerrar(true);
          },
          complete: () => cerrar(true),
        },
      );
    },
    cancel() {
      cancelar();
    },
  });

  return new Response(stream, {
    headers: {
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Content-Type': 'text/event-stream; charset=utf-8',
      'X-Accel-Buffering': 'no',
    },
  });
};

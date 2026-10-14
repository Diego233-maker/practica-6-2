import type { APIRoute } from 'astro';
import { createClient } from 'graphql-ws';
import WebSocket from 'ws';
import { GRAPHQL_WS_URL } from 'astro:env/server';
import { PEDIDO_PAGADO_SUBSCRIPTION } from '../../../lib/queries';

export const GET: APIRoute = ({ locals, request }) => {
  if (!locals.token || locals.usuario?.rol !== 'admin') {
    return new Response('No autorizado', { status: locals.usuario ? 403 : 401 });
  }

  let cancel = () => {};
  const stream = new ReadableStream({
    start(controller) {
      let activo = true;
      const enviar = (evento: string, datos = '') => {
        if (activo) controller.enqueue(new TextEncoder().encode(`event: ${evento}\ndata: ${datos}\n\n`));
      };
      const client = createClient({
        url: GRAPHQL_WS_URL,
        webSocketImpl: WebSocket,
        connectionParams: { authorization: `Bearer ${locals.token}` },
        on: {
          connected: () => enviar('conectado'),
          error: (error) => {
            console.error('Error en WebSocket de la suscripción admin:', error);
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
      let unsubscribe = () => {};
      const heartbeat = setInterval(() => {
        if (activo) controller.enqueue(new TextEncoder().encode(': keep-alive\n\n'));
      }, 25_000);
      cancel = () => cerrar(false);
      request.signal.addEventListener('abort', () => cerrar(true), { once: true });
      unsubscribe = client.subscribe(
        { query: PEDIDO_PAGADO_SUBSCRIPTION },
        {
          next: ({ data, errors }) => {
            if (errors?.length) {
              console.error('Error GraphQL en la suscripción admin:', errors);
              enviar('error', JSON.stringify({ message: 'No se pudo recibir la actualización en tiempo real.' }));
              cerrar(true);
              return;
            }
            if (data?.pedidoPagado) enviar('pedido-pagado', JSON.stringify(data.pedidoPagado));
          },
          error: (error) => {
            console.error('Falló la suscripción GraphQL del panel admin:', error);
            enviar('error', JSON.stringify({ message: 'No se pudo recibir la actualización en tiempo real.' }));
            cerrar(true);
          },
          complete: () => cerrar(true),
        },
      );
    },
    cancel() {
      cancel();
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

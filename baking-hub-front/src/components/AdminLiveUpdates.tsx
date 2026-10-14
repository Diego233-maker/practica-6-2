import { useEffect, useState } from 'react';

export default function AdminLiveUpdates() {
  const [estado, setEstado] = useState('Conectando actualizaciones en tiempo real…');

  useEffect(() => {
    const eventos = new EventSource('/api/admin/pedidos-pagados');
    eventos.addEventListener('open', () => setEstado('Conectando con el backend…'));
    eventos.addEventListener('conectado', () => setEstado('Actualizaciones en tiempo real activas.'));
    eventos.addEventListener('pedido-pagado', () => {
      setEstado('Pago confirmado. Actualizando el resumen…');
      window.location.reload();
    });
    eventos.addEventListener('error', (evento) => {
      const datos = (evento as MessageEvent<string>).data;
      setEstado(datos ? JSON.parse(datos).message : 'No se pudo conectar en tiempo real. Reconectando…');
    });
    return () => eventos.close();
  }, []);

  return <p role="status" aria-live="polite">{estado}</p>;
}

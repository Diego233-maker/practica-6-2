import { useEffect, useState } from 'react';

export default function AdminPresenceUpdates() {
  const [estado, setEstado] = useState('Conectando presencia de clientes…');

  useEffect(() => {
    const eventos = new EventSource('/api/admin/presencia');
    eventos.addEventListener('open', () => setEstado('Conectando con el backend…'));
    eventos.addEventListener('conectado', () => setEstado('Presencia en tiempo real activa.'));
    eventos.addEventListener('presencia-usuario', () => {
      setEstado('Cambió la presencia de un cliente. Actualizando la lista…');
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

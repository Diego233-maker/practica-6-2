import { useEffect } from 'react';

const INTERVALO_PRESENCIA_MS = 20_000;

export default function PresenciaUsuario() {
  useEffect(() => {
    let activo = true;
    let solicitudEnCurso = false;

    const enviarPresencia = async () => {
      if (!activo || document.visibilityState !== 'visible' || solicitudEnCurso) return;
      solicitudEnCurso = true;
      try {
        const respuesta = await fetch('/api/presencia', { method: 'POST' });
        if (!respuesta.ok && respuesta.status !== 401 && respuesta.status !== 403) {
          console.error(`No se pudo actualizar la presencia (HTTP ${respuesta.status}).`);
        }
        if (respuesta.status === 401 || respuesta.status === 403) activo = false;
      } catch (error) {
        console.error('No se pudo actualizar la presencia:', error);
      } finally {
        solicitudEnCurso = false;
      }
    };

    const alCambiarVisibilidad = () => {
      if (document.visibilityState === 'visible') void enviarPresencia();
    };

    void enviarPresencia();
    const intervalo = window.setInterval(() => void enviarPresencia(), INTERVALO_PRESENCIA_MS);
    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    return () => {
      activo = false;
      window.clearInterval(intervalo);
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
    };
  }, []);

  return null;
}

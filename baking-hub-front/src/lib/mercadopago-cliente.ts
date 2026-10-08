import type { ConfigPagos, TarjetaTokenizada } from '../types';

/**
 * Tokenización de la tarjeta en el NAVEGADOR (lo único de Mercado Pago que vive en el frontend).
 *
 * Regla de oro: el número de la tarjeta y el CVV jamás se envían a nuestro servidor. Mercado Pago los
 * convierte en un `token` de un solo uso y solo ese token viaja al backend.
 *
 *  - modo "real":     los campos de número, vencimiento y CVV son "Secure Fields" de MP.js (iframes de Mercado Pago,
 *                     ver FormularioTarjeta.tsx). Aquí solo se pide el token con createCardToken().
 *  - modo "simulado": no se llama a Mercado Pago; se genera un token FALSO para poder probar las pantallas.
 */

export interface DatosTarjeta {
  numero: string;
  titular: string;
  /** MM/AA */
  vencimiento: string;
  cvv: string;
  paymentMethodId?: string;
}

export async function tokenizarTarjeta(datos: DatosTarjeta, modo: ConfigPagos['modo']): Promise<TarjetaTokenizada> {
  return modo === 'real' ? tokenizarConMercadoPago(datos) : tokenizarSimulado(datos);
}

/** Detecta la marca por el inicio del número (solo para el modo simulado). */
function marcaSimulada(numero: string): string {
  if (/^3[47]/.test(numero)) return 'amex';
  if (/^(5[1-5]|2[2-7])/.test(numero)) return 'master';
  return 'visa';
}

async function tokenizarSimulado(datos: DatosTarjeta): Promise<TarjetaTokenizada> {
  const numero = datos.numero.replace(/\D/g, '');
  await new Promise((r) => setTimeout(r, 400)); // simula la llamada de red
  return {
    // Termina en los últimos 4 dígitos: el backend simulado rechaza las tarjetas que terminan en 0002.
    token: `sim_${numero.slice(-4)}`,
    paymentMethodId: marcaSimulada(numero),
    cuotas: 1,
  };
}

/** MP.js rechaza con un arreglo de { code, message } o con un Error; lo convertimos en un texto para el cliente. */
function mensajeErrorMP(e: unknown): string {
  const lista = Array.isArray(e) ? e : [e];
  const textos = lista
    .map((x) => (x && typeof x === 'object' && 'message' in x ? String((x as { message: unknown }).message) : ''))
    .filter(Boolean);
  return textos.length > 0
    ? `Revisa los datos de tu tarjeta (${textos.join('; ')}).`
    : 'No se pudo validar la tarjeta. Revisa los datos e inténtalo de nuevo.';
}

async function tokenizarConMercadoPago(datos: DatosTarjeta): Promise<TarjetaTokenizada> {
  const mp = (window as any).mpInstance;
  if (!mp) throw new Error('El formulario de pago todavía no está listo. Recarga la página e inténtalo de nuevo.');
  if (!datos.paymentMethodId) throw new Error('No pudimos identificar tu tarjeta. Revisa el número e inténtalo de nuevo.');

  let resultado: { id?: string } | undefined;
  try {
    // Los datos de la tarjeta los lee MP.js directamente de sus campos seguros; aquí solo va el nombre.
    resultado = await mp.fields.createCardToken({ cardholderName: datos.titular.trim() });
  } catch (e) {
    throw new Error(mensajeErrorMP(e));
  }
  if (!resultado?.id) throw new Error('No se pudo validar la tarjeta. Revisa los datos e inténtalo de nuevo.');

  return { token: resultado.id, paymentMethodId: datos.paymentMethodId, cuotas: 1 };
}

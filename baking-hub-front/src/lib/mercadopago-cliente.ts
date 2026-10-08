import type { ConfigPagos, TarjetaTokenizada } from '../types';

export interface DatosTarjeta {
  numero: string;
  titular: string;
  vencimiento: string;
  cvv: string;
  paymentMethodId?: string;
}

interface CampoSeguro {
  mount(selector: string): CampoMontado;
}

interface CampoMontado {
  on(evento: 'binChange', callback: (resultado: { bin?: string }) => void): void;
  unmount?: () => void;
}

interface CamposMercadoPago {
  create(nombre: 'cardNumber' | 'expirationDate' | 'securityCode', opciones?: { placeholder?: string }): CampoSeguro;
  createCardToken(datos: { cardholderName: string }): Promise<{ id?: string }>;
}

export interface MercadoPagoInstance {
  fields: CamposMercadoPago;
  getPaymentMethods(datos: { bin: string }): Promise<{ results?: Array<{ id: string }> }>;
}

declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, opciones: { locale: string }) => MercadoPagoInstance;
    mpInstance?: MercadoPagoInstance;
  }
}

const PUBLIC_KEY = import.meta.env.PUBLIC_MP_PUBLIC_KEY?.trim();

export function obtenerMercadoPago(): MercadoPagoInstance {
  if (!PUBLIC_KEY) {
    throw new Error('Falta configurar PUBLIC_MP_PUBLIC_KEY en el frontend para aceptar pagos reales con tarjeta.');
  }
  if (typeof window === 'undefined' || !window.MercadoPago) {
    throw new Error('No se pudo cargar el SDK de Mercado Pago. Revisa tu conexión e inténtalo de nuevo.');
  }

  window.mpInstance ??= new window.MercadoPago(PUBLIC_KEY, { locale: 'es-MX' });
  return window.mpInstance;
}

export async function tokenizarTarjeta(
  datos: DatosTarjeta,
  modo: ConfigPagos['modo'],
): Promise<TarjetaTokenizada> {
  if (modo === 'simulado') return { token: 'sim_4242', paymentMethodId: 'visa', cuotas: 1 };
  if (!datos.paymentMethodId) {
    throw new Error('No pudimos identificar tu tarjeta. Revisa el número e inténtalo de nuevo.');
  }

  try {
    const resultado = await obtenerMercadoPago().fields.createCardToken({ cardholderName: datos.titular.trim() });
    if (!resultado.id) throw new Error('No se recibió un token de Mercado Pago.');
    return { token: resultado.id, paymentMethodId: datos.paymentMethodId, cuotas: 1 };
  } catch (error) {
    if (error instanceof Error && error.message === 'No se recibió un token de Mercado Pago.') throw error;
    const errores = Array.isArray(error) ? error : [error];
    const mensajes = errores
      .map((item) => (item && typeof item === 'object' && 'message' in item ? String(item.message) : ''))
      .filter(Boolean);
    throw new Error(
      mensajes.length
        ? `Revisa los datos de tu tarjeta (${mensajes.join('; ')}).`
        : 'No se pudo validar la tarjeta. Revisa los datos e inténtalo de nuevo.',
    );
  }
}

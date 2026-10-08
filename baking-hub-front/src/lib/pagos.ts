import type { MetodoPago } from '../types';

/** Textos de cada método de pago. Para agregar o quitar métodos, ver también MP_METODOS en el .env del backend. */
export const METODOS: Record<MetodoPago, { etiqueta: string; descripcion: string; icono: string }> = {
  tarjeta: {
    etiqueta: 'Tarjeta de crédito o débito',
    descripcion: 'Visa, Mastercard y American Express. Se cobra al instante.',
    icono: 'VISA',
  },
  oxxo: {
    etiqueta: 'Efectivo en OXXO',
    descripcion: 'Genera una ficha y paga en caja en cualquier tienda OXXO.',
    icono: 'OXXO',
  },
  spei: {
    etiqueta: 'Transferencia SPEI',
    descripcion: 'Transfiere desde la app o la banca en línea de tu banco.',
    icono: 'SPEI',
  },
  mercadopago: {
    etiqueta: 'Mercado Pago',
    descripcion: 'Paga con tu saldo o con las tarjetas guardadas en tu cuenta.',
    icono: 'MP',
  },
};

/** Estados de un pedido: texto y color de la insignia. */
export const ESTADOS_PEDIDO: Record<string, { etiqueta: string; clase: 'ok' | 'warn' | 'error' | 'muted' }> = {
  pendiente: { etiqueta: 'Pendiente de pago', clase: 'warn' },
  pagado: { etiqueta: 'Pagado', clase: 'ok' },
  cancelado: { etiqueta: 'Cancelado', clase: 'error' },
  expirado: { etiqueta: 'Expirado', clase: 'error' },
  reembolsado: { etiqueta: 'Reembolsado', clase: 'muted' },
};

export const estadoPedido = (status: string) =>
  ESTADOS_PEDIDO[status.toLowerCase()] ?? { etiqueta: status, clase: 'muted' as const };

/** Agrupa una referencia en bloques de 4 dígitos para leerla mejor: 1234 5678 9012 34 */
export const formatearReferencia = (ref: string) => ref.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();

export const formatearFecha = (iso: string) =>
  new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });

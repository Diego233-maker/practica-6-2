import type { TarjetaTokenizada } from '../types';

/**
 * Tokenización de la tarjeta en el NAVEGADOR (lo único de Mercado Pago que vive en el frontend).
 *
 * Regla de oro: el número de la tarjeta y el CVV jamás se envían a nuestro servidor. Mercado Pago los
 * convierte en un `token` de un solo uso y solo ese token viaja al backend.
 *
 * Mientras PUBLIC_MP_PUBLIC_KEY esté vacío se usa un token FALSO (modo simulado) para poder probar la pantalla.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * TODO(MERCADO PAGO) — para integrar la API en el frontend:
 *   1. Pon tu clave pública en baking-hub-front/.env:  PUBLIC_MP_PUBLIC_KEY=APP_USR-...
 *   2. Carga el SDK una sola vez (por ejemplo en src/layouts/Layout.astro):
 *        <script src="https://sdk.mercadopago.com/js/v2" is:inline></script>
 *   3. Completa tokenizarConMercadoPago() más abajo.
 *   4. Recomendado por Mercado Pago (seguridad PCI): cambia los <input> de FormularioTarjeta.tsx por los
 *      "Secure Fields" de MP.js, que renderizan los campos dentro de iframes de Mercado Pago.
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 */

export interface DatosTarjeta {
  numero: string;
  titular: string;
  /** MM/AA */
  vencimiento: string;
  cvv: string;
  paymentMethodId?: string;
}

const PUBLIC_KEY = import.meta.env.PUBLIC_MP_PUBLIC_KEY as string | undefined;

export async function tokenizarTarjeta(datos: DatosTarjeta): Promise<TarjetaTokenizada> {
  if (PUBLIC_KEY && PUBLIC_KEY.trim()) return tokenizarConMercadoPago(datos);
  return tokenizarSimulado(datos);
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function tokenizarConMercadoPago(_datos: DatosTarjeta): Promise<TarjetaTokenizada> {
  // TODO(MERCADO PAGO): reemplaza este error por la integración. Esquema (MP.js v2):
  //
  //   const mp = new window.MercadoPago(PUBLIC_KEY, { locale: 'es-MX' });
  //   const [mes, anio] = _datos.vencimiento.split('/');
  //   const { id: token } = await mp.createCardToken({
  //     cardNumber: _datos.numero.replace(/\s/g, ''),
  //     cardholderName: _datos.titular,
  //     cardExpirationMonth: mes,
  //     cardExpirationYear: `20${anio}`,
  //     securityCode: _datos.cvv,
  //   });
  //   const { results } = await mp.getPaymentMethods({ bin: _datos.numero.replace(/\s/g, '').slice(0, 8) });
  //   return { token, paymentMethodId: results[0].id, issuerId: results[0].issuer?.id, cuotas: 1 };
  throw new Error('Falta integrar Mercado Pago en el navegador: completa tokenizarConMercadoPago() en src/lib/mercadopago-cliente.ts');
}

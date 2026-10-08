import 'dotenv/config';
import crypto from 'node:crypto';
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';

/**
 * Capa de pagos de Baking Hub.
 *
 * Todo lo que habla con Mercado Pago vive en ESTE archivo. El resto del backend (index.js) solo usa
 * las funciones exportadas, así que para integrar la API de Mercado Pago basta con completar las
 * tres funciones marcadas con "TODO(MERCADO PAGO)":
 *
 *   1. crearCobroMercadoPago()      -> crea el pago (tarjeta, OXXO, SPEI) o la preferencia (Mercado Pago)
 *   2. consultarPagoMercadoPago()   -> consulta el estado real de un pago (lo usa el webhook)
 *   3. (opcional) revisar verificarFirmaWebhook() contra tu panel de Mercado Pago
 *
 * Mientras MP_MODO=simulado (valor por defecto) NO se llama a Mercado Pago: los pagos se simulan para
 * poder probar todas las pantallas. Cuando termines la integración cambia MP_MODO=real en el .env.
 */

export const METODOS_DISPONIBLES = ['tarjeta', 'oxxo', 'spei', 'mercadopago'];

export const MODO = (process.env.MP_MODO ?? 'simulado').trim().toLowerCase() === 'real' ? 'real' : 'simulado';

/** Métodos que se ofrecen en el checkout. Se pueden recortar con MP_METODOS=tarjeta,oxxo en el .env. */
export const METODOS_ACTIVOS = (process.env.MP_METODOS ?? METODOS_DISPONIBLES.join(','))
  .split(',')
  .map((m) => m.trim().toLowerCase())
  .filter((m) => METODOS_DISPONIBLES.includes(m));

/** Horas que tiene el cliente para pagar en OXXO / SPEI antes de que el pedido expire y se libere el stock. */
export const HORAS_PARA_PAGAR = Number(process.env.PEDIDO_EXPIRA_HORAS) || 72;

const FRONTEND_URL = (process.env.FRONTEND_URL ?? 'http://localhost:4321').replace(/\/$/, '');
const BACKEND_PUBLIC_URL = (process.env.BACKEND_PUBLIC_URL ?? '').replace(/\/$/, '');

if (MODO === 'real') {
  if (!process.env.MP_ACCESS_TOKEN) {
    console.error('❌ MP_MODO=real pero falta MP_ACCESS_TOKEN en tu archivo .env');
    process.exit(1);
  }
  if (!BACKEND_PUBLIC_URL) {
    console.warn('⚠️  Falta BACKEND_PUBLIC_URL: Mercado Pago no podrá avisarte de pagos en OXXO/SPEI (webhook).');
  }
}
const mp = MODO === 'real' ? new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN }) : null;

// Mercado Pago pide la fecha ISO con zona horaria (México = -06:00).
const fechaMP = (d) => new Date(d.getTime() - 6 * 3600_000).toISOString().replace('Z', '-06:00');
if (METODOS_ACTIVOS.length === 0) {
  console.error('❌ MP_METODOS no contiene ningún método válido. Opciones:', METODOS_DISPONIBLES.join(', '));
  process.exit(1);
}

/**
 * Resultado que devuelve crearCobro().
 * @typedef {Object} ResultadoCobro
 * @property {'pagado'|'pendiente'|'rechazado'} estado
 * @property {string|null} pagoId       Id del pago en Mercado Pago (para cruzarlo en el webhook)
 * @property {string|null} referencia   Referencia para pagar en OXXO o CLABE de SPEI
 * @property {Date|null}   expira       Fecha límite para pagar (solo OXXO / SPEI)
 * @property {string|null} url          OXXO/SPEI: ficha de pago de Mercado Pago · mercadopago: URL a la que redirigir al cliente
 */

const aleatorioNumerico = (digitos) =>
  Array.from(crypto.randomBytes(digitos), (b) => b % 10).join('');

/** Crea el cobro de un pedido con el método elegido. */
export async function crearCobro({ pedido, usuario, metodo, tarjeta }) {
  if (MODO === 'simulado') return crearCobroSimulado({ metodo, tarjeta });
  return crearCobroMercadoPago({ pedido, usuario, metodo, tarjeta });
}

/** Consulta el estado real de un pago en Mercado Pago. Devuelve { pagoId, estado, pedidoId }. */
export async function consultarPago(pagoId) {
  if (MODO === 'simulado') throw new Error('consultarPago no se usa en modo simulado');
  return consultarPagoMercadoPago(pagoId);
}

/** Traduce el estado de un pago de Mercado Pago al vocabulario de Baking Hub. */
export function estadoDesdeMercadoPago(status, statusDetail) {
  switch (status) {
    case 'approved':
      return 'pagado';
    case 'pending':
    case 'in_process':
    case 'in_mediation':
    case 'authorized':
      return 'pendiente';
    case 'rejected':
      return 'rechazado';
    case 'cancelled':
      return statusDetail === 'expired' ? 'expirado' : 'cancelado';
    case 'refunded':
    case 'charged_back':
      return 'reembolsado';
    default:
      return 'pendiente';
  }
}

/* ------------------------------------------------------------------------------------------------
 * MODO SIMULADO (no llama a Mercado Pago)
 * -----------------------------------------------------------------------------------------------*/

function crearCobroSimulado({ metodo, tarjeta }) {
  const pagoId = `SIM-${crypto.randomUUID().slice(0, 8)}`;
  const expira = new Date(Date.now() + HORAS_PARA_PAGAR * 60 * 60 * 1000);

  switch (metodo) {
    case 'tarjeta':
      // Para probar un rechazo: usa una tarjeta cuyo número termine en 0002.
      if (tarjeta?.token?.endsWith('0002')) return { estado: 'rechazado', pagoId, referencia: null, expira: null, url: null };
      return { estado: 'pagado', pagoId, referencia: null, expira: null, url: null };
    case 'oxxo':
      return { estado: 'pendiente', pagoId, referencia: aleatorioNumerico(14), expira, url: null };
    case 'spei':
      return { estado: 'pendiente', pagoId, referencia: aleatorioNumerico(18), expira, url: null };
    case 'mercadopago':
      return { estado: 'pagado', pagoId, referencia: null, expira: null, url: null };
    default:
      throw new Error(`Método de pago desconocido: ${metodo}`);
  }
}

/* ------------------------------------------------------------------------------------------------
 * MODO REAL: aquí se integra Mercado Pago
 * -----------------------------------------------------------------------------------------------*/

/**
 * TODO(MERCADO PAGO) — crear el cobro.
 *
 * Instala el SDK:  npm install mercadopago
 *
 *   import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
 *   const mp = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
 *
 * Datos que recibes:
 *   pedido  -> { id, total }            (total en pesos; usa Number(pedido.total))
 *   usuario -> { id, nombre, email }    (el pagador)
 *   metodo  -> 'tarjeta' | 'oxxo' | 'spei' | 'mercadopago'
 *   tarjeta -> { token, paymentMethodId, issuerId, cuotas }   (solo en 'tarjeta'; el token lo genera el navegador)
 *
 * Qué mandar a Mercado Pago según el método (Payments API, new Payment(mp).create({ body, requestOptions })):
 *
 *   tarjeta:  { transaction_amount, token: tarjeta.token, installments: tarjeta.cuotas ?? 1,
 *               payment_method_id: tarjeta.paymentMethodId, issuer_id: tarjeta.issuerId,
 *               payer: { email: usuario.email }, ... }
 *   oxxo:     { transaction_amount, payment_method_id: 'oxxo', date_of_expiration: <ISO con zona horaria>,
 *               payer: { email, first_name, last_name }, ... }
 *   spei:     { transaction_amount, payment_method_id: 'clabe', date_of_expiration: ..., payer: {...}, ... }
 *
 *   En todos incluye:  description, external_reference: String(pedido.id)  <- así el webhook sabe a qué pedido pertenece
 *                      notification_url: `${BACKEND_PUBLIC_URL}/webhooks/mercadopago`
 *                      y en requestOptions un idempotencyKey (p. ej. `pedido-${pedido.id}`).
 *
 *   mercadopago (billetera / Checkout Pro): new Preference(mp).create({ body: { items, payer, external_reference,
 *               notification_url, back_urls: { success/pending/failure: `${FRONTEND_URL}/pedidos/${pedido.id}` },
 *               auto_return: 'approved' } })  -> redirige al cliente a `init_point`.
 *
 * Qué devolver (ver ResultadoCobro arriba):
 *   estado      <- estadoDesdeMercadoPago(pago.status, pago.status_detail)   ('approved' => 'pagado', etc.)
 *   pagoId      <- String(pago.id)
 *   referencia  <- OXXO: pago.transaction_details.payment_method_reference_id  ·  SPEI: la CLABE que devuelva el pago
 *   expira      <- new Date(pago.date_of_expiration)
 *   url         <- OXXO/SPEI: pago.transaction_details.external_resource_url  ·  mercadopago: preference.init_point
 *
 * Si Mercado Pago responde con error, lanza una excepción: index.js cancela el pedido y libera el stock.
 */
// eslint-disable-next-line no-unused-vars
async function crearCobroMercadoPago({ pedido, usuario, metodo, tarjeta }) {
  const monto = Number(pedido.total);
  const notification_url = BACKEND_PUBLIC_URL ? `${BACKEND_PUBLIC_URL}/webhooks/mercadopago` : undefined;
  const [nombre, ...resto] = usuario.nombre.trim().split(/\s+/);
  const requestOptions = { idempotencyKey: `pedido-${pedido.id}-${metodo}` };

  // Billetera de Mercado Pago: se crea una preferencia y se redirige al cliente a init_point.
  if (metodo === 'mercadopago') {
    const expira = new Date(Date.now() + 2 * 3600_000); // el stock se libera si abandona el pago
    const pref = await new Preference(mp).create({
      body: {
        items: [{ id: String(pedido.id), title: `Pedido #${pedido.id} - Baking Hub`, quantity: 1, unit_price: monto, currency_id: 'MXN' }],
        payer: { email: usuario.email },
        external_reference: String(pedido.id),
        notification_url,
        back_urls: {
          success: `${FRONTEND_URL}/pedidos/${pedido.id}?nuevo=1`,
          pending: `${FRONTEND_URL}/pedidos/${pedido.id}?nuevo=1`,
          failure: `${FRONTEND_URL}/pedidos/${pedido.id}`,
        },
        // auto_return: 'approved',  // actívalo cuando uses URLs https públicas (con localhost suele fallar)
        expires: true,
        expiration_date_to: fechaMP(expira),
      },
      requestOptions,
    });
    return { estado: 'pendiente', pagoId: null, referencia: null, expira, url: pref.init_point };
  }

  // Tarjeta, OXXO y SPEI: Payments API
  const body = {
    transaction_amount: monto,
    description: `Pedido #${pedido.id} - Baking Hub`,
    external_reference: String(pedido.id), // así el webhook sabe a qué pedido pertenece
    notification_url,
    payer: { email: usuario.email, first_name: nombre, last_name: resto.join(' ') || nombre },
  };

  if (metodo === 'tarjeta') {
    Object.assign(body, {
      token: tarjeta.token,
      installments: tarjeta.cuotas ?? 1,
      payment_method_id: tarjeta.paymentMethodId,
      issuer_id: tarjeta.issuerId ? Number(tarjeta.issuerId) : undefined,
    });
  } else {
    const limite = new Date(Date.now() + HORAS_PARA_PAGAR * 3600_000);
    Object.assign(body, {
      payment_method_id: metodo === 'oxxo' ? 'oxxo' : 'clabe',
      date_of_expiration: fechaMP(limite),
    });
  }

  const pago = await new Payment(mp).create({ body, requestOptions });
  // console.log(JSON.stringify(pago, null, 2)); // descomenta la primera vez para ver la respuesta completa

  const estado = estadoDesdeMercadoPago(pago.status, pago.status_detail);
  const td = pago.transaction_details ?? {};
  return {
    estado: estado === 'pagado' || estado === 'pendiente' ? estado : 'rechazado',
    pagoId: String(pago.id),
    referencia: td.payment_method_reference_id ?? null,
    expira: pago.date_of_expiration ? new Date(pago.date_of_expiration) : null,
    url: td.external_resource_url ?? null,
  };
}

async function consultarPagoMercadoPago(pagoId) {
  const pago = await new Payment(mp).get({ id: pagoId });
  return {
    pagoId: String(pago.id),
    estado: estadoDesdeMercadoPago(pago.status, pago.status_detail),
    pedidoId: pago.external_reference ? Number(pago.external_reference) : null,
  };
}

/**
 * Valida la firma que Mercado Pago pone en cada notificación (cabecera x-signature) para asegurar que
 * el aviso realmente viene de ellos. Necesita MP_WEBHOOK_SECRET (Tus integraciones -> Webhooks -> clave secreta).
 * Ya está implementado; solo confirma en la documentación de Mercado Pago que el formato no haya cambiado.
 */
export function verificarFirmaWebhook(req) {
  const secreto = process.env.MP_WEBHOOK_SECRET;
  if (!secreto) {
    console.error('Webhook rechazado: falta MP_WEBHOOK_SECRET en el .env');
    return false;
  }
  const firma = String(req.get('x-signature') ?? '');
  const requestId = String(req.get('x-request-id') ?? '');
  const partes = Object.fromEntries(
    firma.split(',').map((p) => {
      const [k, ...v] = p.trim().split('=');
      return [k, v.join('=')];
    }),
  );
  const { ts, v1 } = partes;
  if (!ts || !v1) return false;

  // El id viene en la query (?data.id=123). Si es alfanumérico, Mercado Pago lo firma en minúsculas.
  const dataId = String(req.query['data.id'] ?? req.body?.data?.id ?? '').toLowerCase();
  const manifiesto = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const esperado = crypto.createHmac('sha256', secreto).update(manifiesto).digest('hex');

  const a = Buffer.from(esperado);
  const b = Buffer.from(v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export { FRONTEND_URL, BACKEND_PUBLIC_URL };

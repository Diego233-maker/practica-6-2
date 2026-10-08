import 'dotenv/config';
import crypto from 'node:crypto';
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';

/**
 * Capa de pagos de Baking Hub.
 *
 * Todo lo que habla con Mercado Pago vive en ESTE archivo. El resto del backend (index.js) solo usa
 * las funciones exportadas:
 *
 *   crearCobroMercadoPago()      -> crea el pago (tarjeta, OXXO, SPEI) o la preferencia (billetera)
 *   consultarPagoMercadoPago()   -> consulta el estado real de un pago (webhook y conciliación)
 *   buscarPagosDePedido()        -> busca los pagos de un pedido por external_reference (billetera)
 *   verificarFirmaWebhook()      -> valida la cabecera x-signature de los avisos
 *
 * La integración YA está hecha: para usarla basta con llenar el .env (ver .env.example) y poner
 * MP_MODO=real. Mientras MP_MODO=simulado (valor por defecto) NO se llama a Mercado Pago: los pagos se
 * simulan para poder probar todas las pantallas. El modo simulado se rechaza con NODE_ENV=production.
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

// En simulado cualquier cliente puede "simular" que pagó (mutation simularPago): jamás en producción.
if (MODO === 'simulado' && process.env.NODE_ENV === 'production') {
  console.error('❌ MP_MODO=simulado no se permite con NODE_ENV=production (cualquiera podría marcar sus pedidos como pagados).');
  console.error('   Usa MP_MODO=real con tus credenciales de Mercado Pago.');
  process.exit(1);
}

if (MODO === 'real') {
  if (!process.env.MP_ACCESS_TOKEN) {
    console.error('❌ MP_MODO=real pero falta MP_ACCESS_TOKEN en tu archivo .env');
    process.exit(1);
  }
  if (BACKEND_PUBLIC_URL && !process.env.MP_WEBHOOK_SECRET) {
    // Sin la clave secreta el webhook rechaza todos los avisos (401) y Mercado Pago los reintenta durante días.
    console.error('❌ Hay BACKEND_PUBLIC_URL pero falta MP_WEBHOOK_SECRET (Tus integraciones → Webhooks → clave secreta).');
    process.exit(1);
  }
  if (!BACKEND_PUBLIC_URL) {
    console.warn(
      '⚠️  Sin BACKEND_PUBLIC_URL no hay webhook: los pagos de OXXO/SPEI se confirmarán por consulta periódica\n' +
        '   a Mercado Pago (cada 5 min). Para confirmación inmediata, pon una URL https pública en BACKEND_PUBLIC_URL.'
    );
  } else if (!BACKEND_PUBLIC_URL.startsWith('https://')) {
    console.warn('⚠️  BACKEND_PUBLIC_URL debería ser https://… (Mercado Pago exige HTTPS para las notificaciones).');
  }
  if (!process.env.MP_WEBHOOK_SECRET) {
    console.warn('⚠️  Falta MP_WEBHOOK_SECRET: se ignorarán los webhooks; la conciliación periódica seguirá consultando pagos pendientes.');
  }
}
const mp = MODO === 'real' ? new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN }) : null;

if (MODO === 'real') {
  console.log(
    '💳 Mercado Pago: token y clave pública deben ser del MISMO entorno (ambas de prueba o ambas de producción).\n' +
      '   Si ves "Unauthorized use of live credentials" (código 7), revisa PASO A PASO la sección de credenciales del README.'
  );
}

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

/** Consulta el estado real de un pago en Mercado Pago. Devuelve { pagoId, estado, pedidoId, monto, moneda }. */
export async function consultarPago(pagoId) {
  if (MODO === 'simulado') throw new Error('consultarPago no se usa en modo simulado');
  return consultarPagoMercadoPago(pagoId);
}

/**
 * Busca en Mercado Pago los pagos hechos para un pedido (por external_reference).
 * Sirve para el pago con la billetera (Checkout Pro), donde el id del pago no se conoce hasta que el cliente paga.
 */
export async function buscarPagosDePedido(pedidoId) {
  if (MODO === 'simulado') return [];
  const res = await new Payment(mp).search({
    options: { external_reference: String(pedidoId), sort: 'date_created', criteria: 'desc', limit: 10 },
  });
  return (res.results ?? []).map(resumenPago);
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
 * MODO REAL
 * -----------------------------------------------------------------------------------------------*/

/**
 * Crea el cobro en Mercado Pago (Payments API para tarjeta/OXXO/SPEI, Preferences para la billetera).
 *
 * Datos que recibe:
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
    const pref = await llamarMP(() => new Preference(mp).create({
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
    }));
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

  const pago = await llamarMP(() => new Payment(mp).create({ body, requestOptions }));
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

/**
 * Ejecuta una llamada a Mercado Pago y, si falla, imprime un diagnóstico legible (status, código y causas)
 * antes de relanzar el error. Así el log dice QUÉ revisar en vez de solo "MPAuthenticationError".
 */
async function llamarMP(fn) {
  try {
    return await fn();
  } catch (error) {
    const causas = Array.isArray(error?.cause) ? error.cause : Array.isArray(error?.causes) ? error.causes : [];
    const codigos = causas.map((c) => c?.code);
    if (error?.status === 401 && codigos.includes(7)) {
      console.error(
        '❌ Mercado Pago rechazó las credenciales (401 / código 7: "Unauthorized use of live credentials").\n' +
          '   Causas habituales:\n' +
          '   1) Usas credenciales de PRODUCCIÓN pero tu aplicación aún no está activada para producción\n' +
          '      (Tus integraciones → tu app → Credenciales de producción → completar y activar).\n' +
          '   2) Usas credenciales de producción con un comprador/tarjeta de PRUEBA, o credenciales de prueba mezcladas\n' +
          '      con las de producción (MP_ACCESS_TOKEN y PUBLIC_MP_PUBLIC_KEY deben ser del mismo entorno).\n' +
          '   3) El comprador usa el mismo correo/cuenta que el vendedor dueño de las credenciales.'
      );
    } else {
      console.error(`❌ Error de Mercado Pago (status ${error?.status ?? '?'}):`, JSON.stringify(causas.length ? causas : error?.message));
    }
    throw error;
  }
}

/** Reduce un pago de Mercado Pago a los datos que usa Baking Hub. */
function resumenPago(pago) {
  const pedidoId = Number(pago.external_reference);
  return {
    pagoId: String(pago.id),
    estado: estadoDesdeMercadoPago(pago.status, pago.status_detail),
    pedidoId: Number.isInteger(pedidoId) && pedidoId > 0 ? pedidoId : null,
    monto: Number(pago.transaction_amount),
    moneda: pago.currency_id ?? null,
  };
}

async function consultarPagoMercadoPago(pagoId) {
  return resumenPago(await new Payment(mp).get({ id: pagoId }));
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

  // Plantilla oficial: "id:[data.id];request-id:[x-request-id];ts:[ts];". El id va en minúsculas y,
  // según la documentación, si algún valor no viene en el aviso se quita ese segmento del manifiesto.
  const dataId = idDeNotificacion(req).toLowerCase();
  const manifiesto = [dataId && `id:${dataId};`, requestId && `request-id:${requestId};`, `ts:${ts};`].filter(Boolean).join('');
  const esperado = crypto.createHmac('sha256', secreto).update(manifiesto).digest('hex');

  const a = Buffer.from(esperado);
  const b = Buffer.from(v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Id del recurso del aviso. Se lee SIEMPRE de la query (?data.id=…), que es lo que Mercado Pago firma;
 * el cuerpo solo se usa si la query no lo trae. Se usa tanto para verificar la firma como para procesar
 * el aviso, así no se puede firmar un id y procesar otro.
 */
export function idDeNotificacion(req) {
  return String(req.query?.['data.id'] ?? req.body?.data?.id ?? '');
}

export { FRONTEND_URL, BACKEND_PUBLIC_URL };
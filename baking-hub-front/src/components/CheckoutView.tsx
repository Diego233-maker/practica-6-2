import { useState } from 'react';
import { useStore } from '@nanostores/react';
import { carrito, totalArticulos, totalPrecio, vaciar } from '../stores/carrito';
import { precio } from '../lib/format';
import { METODOS } from '../lib/pagos';
import { tokenizarTarjeta, type DatosTarjeta } from '../lib/mercadopago-cliente';
import { validarTarjeta, type ErroresTarjeta } from '../lib/tarjeta';
import type { ConfigPagos, MetodoPago, TarjetaTokenizada } from '../types';
import MetodosPago from './MetodosPago';
import FormularioTarjeta from './FormularioTarjeta';
import '../styles/carrito.css';
import '../styles/pago.css';

interface Props {
  config: ConfigPagos;
  usuario: { nombre: string; email: string };
}

const TARJETA_VACIA: DatosTarjeta = { numero: '', titular: '', vencimiento: '', cvv: '' };

export default function CheckoutView({ config, usuario }: Props) {
  const items = useStore(carrito);
  const articulos = useStore(totalArticulos);
  const total = useStore(totalPrecio);

  const [metodo, setMetodo] = useState<MetodoPago>(config.metodos[0] ?? 'tarjeta');
  const [tarjeta, setTarjeta] = useState<DatosTarjeta>(TARJETA_VACIA);
  const [erroresTarjeta, setErroresTarjeta] = useState<ErroresTarjeta>({});
  const [pagando, setPagando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <p className="estado-vacio">
        Tu carrito está vacío. <a href="/">Ver el catálogo</a>
      </p>
    );
  }

  const manejarPago = async () => {
    setError(null);
    let datosTarjeta: TarjetaTokenizada | undefined;

    if (metodo === 'tarjeta') {
      // En modo real el número, vencimiento y CVV viven en iframes de Mercado Pago: aquí solo se valida el
      // nombre y MP.js valida el resto al pedir el token. En modo simulado se validan todos los campos.
      const errores: ErroresTarjeta =
        config.modo === 'real'
          ? tarjeta.titular.trim().length < 3
            ? { titular: 'Escribe el nombre como aparece en la tarjeta.' }
            : {}
          : validarTarjeta(tarjeta);
      setErroresTarjeta(errores);
      if (Object.keys(errores).length > 0) return;
    }

    setPagando(true);

    try {
      // Los datos de la tarjeta se conservan en pantalla si algo falla, para que el cliente pueda reintentar.
      if (metodo === 'tarjeta') datosTarjeta = await tokenizarTarjeta(tarjeta, config.modo);

      const productos = items.flatMap((i) => Array<string>(i.cantidad).fill(i.id));
      const res = await fetch('/api/pedido', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productos, metodoPago: metodo, tarjeta: datosTarjeta }),
      });

      if (res.status === 401) {
        window.location.assign('/login?next=/checkout');
        return;
      }

      const datos = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(datos.error ?? 'Hubo un error al procesar el pago.');

      vaciar();
      const { id, pagoUrl } = datos.pedido as { id: string; pagoUrl: string | null };

      if (metodo === 'mercadopago' && pagoUrl && pagoUrl.startsWith('https://')) {
        window.location.assign(pagoUrl);
        return;
      }

      window.location.assign(`/pedidos/${id}?nuevo=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hubo un error al procesar el pago. Inténtalo de nuevo.');
      setPagando(false);
    }
  };

  const textoBoton = pagando
    ? 'Procesando…'
    : metodo === 'oxxo'
      ? `Generar ficha de pago · ${precio(total)}`
      : metodo === 'spei'
        ? `Generar datos de transferencia · ${precio(total)}`
        : metodo === 'mercadopago'
          ? `Continuar a Mercado Pago · ${precio(total)}`
          : `Pagar ${precio(total)}`;

  return (
    <div className="checkout-grid">
      <section className="checkout-main" aria-label="Método de pago">
        {config.modo === 'simulado' && (
          <p className="aviso-simulado" role="note">
            🧪 <strong>Modo de pruebas.</strong> No se hará ningún cobro real.
          </p>
        )}

        <MetodosPago metodos={config.metodos} seleccionado={metodo} deshabilitado={pagando} onChange={setMetodo} />

        <div className="metodo-detalle">
          {metodo === 'tarjeta' && (
            <FormularioTarjeta
              modo={config.modo}
              valores={tarjeta}
              errores={erroresTarjeta}
              deshabilitado={pagando}
              onChange={setTarjeta}
            />
          )}

          {metodo === 'oxxo' && (
            <div className="instrucciones">
              <p>Al continuar generaremos una <strong>ficha con una referencia de pago</strong>.</p>
              <ol>
                <li>Llévala a cualquier tienda OXXO (puedes mostrarla desde tu celular).</li>
                <li>Paga el monto exacto en caja.</li>
                <li>Tu pedido se confirma en cuanto se acredite el pago.</li>
              </ol>
              <p className="nota">
                Tienes <strong>{config.horasParaPagar} horas</strong> para pagar; después el pedido se cancela y las piezas
                vuelven al inventario.
              </p>
            </div>
          )}

          {metodo === 'spei' && (
            <div className="instrucciones">
              <p>Al continuar te mostraremos una <strong>CLABE interbancaria</strong> y el monto exacto.</p>
              <ol>
                <li>Abre la app o la banca en línea de tu banco.</li>
                <li>Haz una transferencia SPEI a esa CLABE por el monto indicado.</li>
                <li>Tu pedido se confirma en cuanto se acredite la transferencia.</li>
              </ol>
              <p className="nota">Tienes <strong>{config.horasParaPagar} horas</strong> para transferir.</p>
            </div>
          )}

          {metodo === 'mercadopago' && (
            <div className="instrucciones">
              <p>
                Te llevaremos a <strong>Mercado Pago</strong> para que completes el pago de forma segura con tu cuenta, y
                regresarás aquí al terminar.
              </p>
            </div>
          )}
        </div>

        <p className="pagador">
          Pagas como <strong>{usuario.nombre}</strong> ({usuario.email})
        </p>

        {error && (
          <p className="mensaje-error" role="alert">
            {error}
          </p>
        )}

        <button className={`pagar-btn ${pagando ? 'procesando' : 'activo'}`} onClick={manejarPago} disabled={pagando}>
          {textoBoton}
        </button>
        <a className="cancelar-btn" href="/carrito">
          Cancelar y regresar
        </a>
        <p className="seguridad">🔒 Tus datos de pago los procesa Mercado Pago; Baking Hub nunca guarda tu tarjeta.</p>
      </section>

      <aside className="checkout-resumen" aria-label="Resumen de tu orden">
        <h3>Tu orden</h3>
        <ul>
          {items.map((i) => (
            <li key={i.id}>
              <span>
                {i.cantidad} × {i.nombre}
              </span>
              <span>{precio(i.precio * i.cantidad)}</span>
            </li>
          ))}
        </ul>
        <p className="resumen-linea">
          <span>Artículos</span>
          <span>{articulos}</span>
        </p>
        <p className="resumen-total">
          <span>Total a pagar</span>
          <strong>{precio(total)}</strong>
        </p>
        <p className="resumen-metodo">
          {METODOS[metodo].icono} {METODOS[metodo].etiqueta}
        </p>
      </aside>
    </div>
  );
}
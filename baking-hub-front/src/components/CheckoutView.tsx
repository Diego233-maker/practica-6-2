import { useState } from 'react';
import { useStore } from '@nanostores/react';
import { carrito, totalArticulos, totalPrecio, vaciar } from '../stores/carrito';
import { precio } from '../lib/format';
import '../styles/carrito.css';

export default function CheckoutView() {
  const items = useStore(carrito);
  const articulos = useStore(totalArticulos);
  const total = useStore(totalPrecio);
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
    setPagando(true);
    setError(null);
    try {
      // El backend cuenta los ids repetidos como cantidad.
      const productos = items.flatMap((i) => Array<string>(i.cantidad).fill(i.id));
      const res = await fetch('/api/pedido', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productos }),
      });

      if (res.status === 401) {
        window.location.assign('/login?next=/checkout');
        return;
      }
      const datos = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(datos.error ?? 'Hubo un error al procesar el pago.');

      vaciar();
      window.location.assign(`/pedidos?nuevo=${datos.pedido.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hubo un error al procesar el pago. Inténtalo de nuevo.');
      setPagando(false);
    }
  };

  return (
    <div className="checkout-card">
      <p>Total de artículos: {articulos}</p>
      <p>
        Total a pagar: <strong>{precio(total)}</strong>
      </p>
      {error && (
        <p className="mensaje-error" role="alert">
          {error}
        </p>
      )}
      <button className={`pagar-btn ${pagando ? 'procesando' : 'activo'}`} onClick={manejarPago} disabled={pagando}>
        {pagando ? 'Procesando con el banco...' : 'Confirmar y pagar'}
      </button>
      <a className="cancelar-btn" href="/carrito">
        Cancelar y regresar
      </a>
    </div>
  );
}

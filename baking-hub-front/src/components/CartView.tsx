import { useStore } from '@nanostores/react';
import { cambiarCantidad, carrito, quitar, totalPrecio } from '../stores/carrito';
import { precio } from '../lib/format';
import '../styles/carrito.css';

export default function CartView() {
  const items = useStore(carrito);
  const total = useStore(totalPrecio);

  if (items.length === 0) {
    return (
      <p className="estado-vacio">
        Aún no has agregado nada delicioso. <a href="/">Ver el catálogo</a>
      </p>
    );
  }

  return (
    <>
      <ul className="carrito-lista">
        {items.map((item) => (
          <li className="carrito-item" key={item.id}>
            <strong>{item.nombre}</strong>
            <span className="carrito-cantidad">
              <button aria-label={`Quitar una unidad de ${item.nombre}`} onClick={() => cambiarCantidad(item.id, -1)}>
                −
              </button>
              <span aria-label={`Cantidad: ${item.cantidad}`}>{item.cantidad}</span>
              <button aria-label={`Agregar una unidad de ${item.nombre}`} onClick={() => cambiarCantidad(item.id, 1)}>
                +
              </button>
            </span>
            <span>{precio(item.precio * item.cantidad)}</span>
            <button className="quitar-btn" onClick={() => quitar(item.id)}>
              Quitar
            </button>
          </li>
        ))}
      </ul>
      <p className="carrito-total">
        Total: <strong>{precio(total)}</strong>
      </p>
      <a className="checkout-btn" href="/checkout">
        Ir al checkout
      </a>
    </>
  );
}

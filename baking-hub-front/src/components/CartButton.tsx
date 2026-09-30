import { useStore } from '@nanostores/react';
import { totalArticulos } from '../stores/carrito';

export default function CartButton() {
  const cantidad = useStore(totalArticulos);
  return (
    <a className="cart-button" href="/carrito">
      Carrito ({cantidad})
    </a>
  );
}

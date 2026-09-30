import { agregar } from '../stores/carrito';
import type { Producto } from '../types';

export default function AddToCartButton({ producto }: { producto: Producto }) {
  const alHacerClic = () => {
    agregar(producto);
    window.location.assign('/carrito');
  };

  return (
    <button className="btn-primario" onClick={alHacerClic}>
      Añadir al carrito
    </button>
  );
}

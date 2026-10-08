import { persistentAtom } from '@nanostores/persistent';
import { computed } from 'nanostores';
import type { ItemCarrito, Producto } from '../types';

const MAX_POR_PRODUCTO = 20;

/** Máximo que se puede llevar de un producto: 20 o las piezas que haya en inventario (lo que sea menor). */
export const tope = (item: { stock?: number }) => Math.min(MAX_POR_PRODUCTO, item.stock ?? MAX_POR_PRODUCTO);

/** Carrito compartido entre todas las islas React y guardado en localStorage. */
export const carrito = persistentAtom<ItemCarrito[]>('bh:carrito', [], {
  encode: JSON.stringify,
  decode: (valor) => {
    try {
      const datos = JSON.parse(valor);
      return Array.isArray(datos) ? datos : [];
    } catch {
      return [];
    }
  },
});

export const totalArticulos = computed(carrito, (items) => items.reduce((s, i) => s + i.cantidad, 0));
export const totalPrecio = computed(carrito, (items) => items.reduce((s, i) => s + i.precio * i.cantidad, 0));

export function agregar(producto: Producto) {
  if (producto.stock <= 0) return; // agotado
  const items = carrito.get();
  const existente = items.find((i) => i.id === producto.id);
  carrito.set(
    existente
      // Se refresca el stock guardado con el dato más reciente del servidor.
      ? items.map((i) => (i.id === producto.id ? { ...i, stock: producto.stock, cantidad: Math.min(i.cantidad + 1, tope(producto)) } : i))
      : [...items, { ...producto, cantidad: 1 }],
  );
}

export function cambiarCantidad(id: string, delta: number) {
  carrito.set(
    carrito
      .get()
      .map((i) => (i.id === id ? { ...i, cantidad: Math.min(i.cantidad + delta, tope(i)) } : i))
      .filter((i) => i.cantidad > 0),
  );
}

export function quitar(id: string) {
  carrito.set(carrito.get().filter((i) => i.id !== id));
}

export function vaciar() {
  carrito.set([]);
}

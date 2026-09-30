export interface Producto {
  id: string;
  nombre: string;
  precio: number;
  imagen: string;
}

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: 'cliente' | 'admin';
}

export interface ItemCarrito extends Producto {
  cantidad: number;
}

export interface ItemPedido {
  id: string;
  nombre: string;
  precio: number;
  cantidad: number;
}

export interface Pedido {
  id: string;
  total: number;
  status: string;
  fecha: string;
  productos: ItemPedido[];
}

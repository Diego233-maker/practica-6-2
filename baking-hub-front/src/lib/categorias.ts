export const CATEGORIAS = ['Todas', 'Chocolates', 'Panadería'] as const;
export type Categoria = (typeof CATEGORIAS)[number];

/** Deduce la categoría de un producto a partir de su nombre (misma lógica que el proyecto original). */
export function obtenerCategoria(nombre: string): Categoria | 'Otra' {
  const texto = nombre.toLowerCase();
  if (texto.includes('chocolate')) return 'Chocolates';
  if (['pan', 'rol', 'galleta', 'pastel'].some((palabra) => texto.includes(palabra))) {
    return 'Panadería';
  }
  return 'Otra';
}

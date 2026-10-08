import { ApiError } from './graphql';

/** Error de validación del formulario (se muestra tal cual al administrador). */
export class ErrorFormulario extends Error {}

export function mensajeError(e: unknown): string {
  if (e instanceof ErrorFormulario) return e.message;
  if (e instanceof ApiError) return e.message;
  return 'Ocurrió un error inesperado. Inténtalo de nuevo.';
}

/** Lee un campo de texto de un formulario ya limpio de espacios. */
export const texto = (datos: FormData, campo: string) => String(datos.get(campo) ?? '').trim();

export function numero(datos: FormData, campo: string, etiqueta: string): number {
  const valor = Number(texto(datos, campo));
  if (texto(datos, campo) === '' || !Number.isFinite(valor)) throw new ErrorFormulario(`${etiqueta} no es válido.`);
  return valor;
}

export function entero(datos: FormData, campo: string, etiqueta: string): number {
  const valor = numero(datos, campo, etiqueta);
  if (!Number.isInteger(valor)) throw new ErrorFormulario(`${etiqueta} debe ser un número entero.`);
  return valor;
}

/** Nivel de existencias para pintar la insignia. */
export function nivelStock(stock: number): { clase: 'ok' | 'warn' | 'error'; etiqueta: string } {
  if (stock <= 0) return { clase: 'error', etiqueta: 'Agotado' };
  if (stock <= 5) return { clase: 'warn', etiqueta: `Stock bajo: ${stock}` };
  return { clase: 'ok', etiqueta: `${stock} en stock` };
}

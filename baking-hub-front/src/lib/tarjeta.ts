import type { DatosTarjeta } from './mercadopago-cliente';

export type ErroresTarjeta = Partial<Record<keyof DatosTarjeta, string>>;

/** Algoritmo de Luhn: detecta números de tarjeta mal escritos antes de molestar a Mercado Pago. */
export function luhnValido(numero: string): boolean {
  const digitos = numero.replace(/\D/g, '');
  if (digitos.length < 13 || digitos.length > 19) return false;
  let suma = 0;
  let doble = false;
  for (let i = digitos.length - 1; i >= 0; i--) {
    let d = Number(digitos[i]);
    if (doble) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    suma += d;
    doble = !doble;
  }
  return suma % 10 === 0;
}

export function validarTarjeta(d: DatosTarjeta): ErroresTarjeta {
  const errores: ErroresTarjeta = {};
  if (!luhnValido(d.numero)) errores.numero = 'Revisa el número de la tarjeta.';
  if (d.titular.trim().length < 3) errores.titular = 'Escribe el nombre como aparece en la tarjeta.';

  const m = /^(\d{2})\/(\d{2})$/.exec(d.vencimiento);
  if (!m) {
    errores.vencimiento = 'Usa el formato MM/AA.';
  } else {
    const mes = Number(m[1]);
    const anio = 2000 + Number(m[2]);
    const ahora = new Date();
    const vencida = anio < ahora.getFullYear() || (anio === ahora.getFullYear() && mes < ahora.getMonth() + 1);
    if (mes < 1 || mes > 12) errores.vencimiento = 'El mes no es válido.';
    else if (vencida) errores.vencimiento = 'La tarjeta está vencida.';
  }

  if (!/^\d{3,4}$/.test(d.cvv)) errores.cvv = 'El código tiene 3 o 4 dígitos.';
  return errores;
}

export const formatearNumero = (v: string) =>
  v
    .replace(/\D/g, '')
    .slice(0, 19)
    .replace(/(.{4})/g, '$1 ')
    .trim();

export function formatearVencimiento(v: string) {
  const digitos = v.replace(/\D/g, '').slice(0, 4);
  return digitos.length > 2 ? `${digitos.slice(0, 2)}/${digitos.slice(2)}` : digitos;
}

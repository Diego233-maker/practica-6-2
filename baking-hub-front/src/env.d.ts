/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  /** Clave pública de Mercado Pago (se expone al navegador a propósito; nunca pongas aquí el Access Token). */
  readonly PUBLIC_MP_PUBLIC_KEY?: string;
}

declare namespace App {
  interface Locals {
    /** Usuario autenticado de esta petición (null si es visitante). */
    usuario: import('./types').Usuario | null;
    /** JWT de la cookie de sesión (null si no hay). */
    token: string | null;
  }
}

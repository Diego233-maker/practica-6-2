/// <reference path="../.astro/types.d.ts" />

declare namespace App {
  interface Locals {
    /** Usuario autenticado de esta petición (null si es visitante). */
    usuario: import('./types').Usuario | null;
    /** JWT de la cookie de sesión (null si no hay). */
    token: string | null;
  }
}

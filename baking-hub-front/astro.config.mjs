// @ts-check
import { defineConfig, envField } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';

export default defineConfig({
  // Todas las páginas se renderizan en el servidor: necesitamos leer la cookie de sesión.
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [react()],
  vite: {
    server: {
      allowedHosts: ['rinse-bless-licorice.ngrok-free.dev'],
    },
  },
  env: {
    schema: {
      // URL del backend GraphQL. Solo se usa en el servidor, nunca llega al navegador.
      GRAPHQL_URL: envField.string({
        context: 'server',
        access: 'secret',
        default: 'http://localhost:4000/',
      }),
    },
  },
});

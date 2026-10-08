# Baking Hub — frontend (Astro)

Tienda de postres. Astro 7 con renderizado en servidor (`@astrojs/node`), islas de React solo para lo interactivo (carrito y checkout) y autenticación con cookie `HttpOnly`.

```bash
cp .env.example .env   # GRAPHQL_URL apunta al backend (por defecto http://localhost:4000/)
npm install
npm run dev            # http://localhost:4321
```

Otros comandos: `npm run check` (tipos), `npm run build`, `npm start` (sirve el build).

## Estructura

```
src/
├── layouts/Layout.astro        Página base: <head>, Header, Sidebar opcional, Footer
├── components/
│   ├── Header.astro            Marca, enlaces de cuenta (Ingresar / Salir) y carrito
│   ├── Sidebar.astro           Categorías (enlaces reales: /?categoria=…)
│   ├── Hero.astro  WhyUs.astro  Footer.astro  Alert.astro
│   ├── ProductCard.astro       Tarjeta del catálogo
│   ├── ProductDetail.astro     Detalle de un producto
│   ├── PedidoCard.astro        Un pedido del historial
│   ├── AuthCard.astro  FormField.astro   Tarjeta y campo de los formularios de login/registro
│   └── (islas React)  CartButton.tsx  AddToCartButton.tsx  CartView.tsx  CheckoutView.tsx
├── pages/                      Una ruta por archivo (reemplaza el estado `pantallaActual`)
│   ├── index.astro             /                  catálogo (?categoria=Chocolates)
│   ├── producto/[id].astro     /producto/2        detalle
│   ├── carrito.astro           /carrito
│   ├── checkout.astro          /checkout          🔒 requiere sesión
│   ├── pedidos.astro           /pedidos           🔒 requiere sesión
│   ├── login.astro  registro.astro
│   └── api/
│       ├── auth/logout.ts      POST /api/auth/logout
│       └── pedido.ts           POST /api/pedido   crea el pedido con el token de la cookie
├── middleware.ts               Lee la cookie, consulta `me` al backend y protege rutas
├── stores/carrito.ts           Carrito compartido entre islas (nanostores + localStorage)
├── lib/                        graphql.ts (cliente fetch), queries.ts, auth.ts, categorias.ts, format.ts
├── styles/                     global.css (tokens y piezas compartidas), carrito.css (islas React)
└── types.ts
```

## Cómo funciona la autenticación

1. `login.astro` / `registro.astro` reciben el formulario (POST), llaman al backend y guardan el JWT en la cookie `bh_token` (`HttpOnly`, `SameSite=Lax`, `Secure` en producción). El JavaScript del navegador nunca ve el token.
2. `middleware.ts` corre en cada petición: si hay cookie, pregunta `me` al backend. Si el token venció o es falso, borra la cookie.
3. Las rutas de `RUTAS_PROTEGIDAS` (en `middleware.ts`) redirigen a `/login?next=…` si no hay sesión. Para proteger otra ruta, agrégala a esa lista.
4. Los permisos reales viven en el **backend** (crear pedidos requiere sesión; crear/eliminar productos requiere rol `admin`), no solo en la interfaz.

## Pagos y panel admin (nuevo)

| Ruta / archivo | Qué hace |
|---|---|
| `/checkout` + `components/CheckoutView.tsx` | Elegir método de pago (tarjeta, OXXO, SPEI, Mercado Pago) |
| `lib/mercadopago-cliente.ts` | Tokeniza la tarjeta en el navegador (punto de integración con MP.js) |
| `/pedidos/[id]` + `components/InstruccionesPago.astro` | Ficha de pago OXXO / SPEI y estado del pedido |
| `/admin`, `/admin/inventario`, `/admin/usuarios` | Panel de administración (solo rol `admin`, ver `middleware.ts`) |

# Cómo ejecutar Baking Hub en Arch Linux

Este proyecto tiene dos partes que deben correr **al mismo tiempo**, en dos terminales
distintas:

- `backend-practica-6-2/` → servidor GraphQL (Apollo Server + PostgreSQL + JWT), puerto **4000**
- `baking-hub-front/` → frontend en **Astro** (con islas de React), puerto **4321**

## Qué cambió

- **Frontend migrado de React + Vite a Astro** (renderizado en servidor). Cada pantalla es ahora una
  ruta real (`/`, `/producto/2`, `/carrito`, `/checkout`, `/pedidos`, `/login`, `/registro`) y el
  antiguo `App.jsx` de ~250 líneas quedó separado en componentes en `src/components/`. Ver
  `baking-hub-front/README.md` para el mapa completo.
- **Autenticación**: registro, login y logout. El backend guarda usuarios con contraseña
  hasheada (bcrypt) y emite un JWT; Astro lo guarda en una cookie `HttpOnly`. Pagar en el
  checkout y ver el historial (`/pedidos`) requiere iniciar sesión; el catálogo sigue siendo público.
- **Roles**: `crearProducto` y `eliminarProducto` ahora solo los puede ejecutar un usuario `admin`.
- **Corrección en pedidos**: antes, agregar el mismo producto dos veces al carrito hacía fallar el
  pedido (llave primaria duplicada). Ahora se guarda una `cantidad` por producto, el total se calcula
  en el servidor con los precios de la base de datos y todo ocurre en una transacción.

## Pagos con Mercado Pago y panel de administración

- **Checkout** (`/checkout`): el cliente elige entre tarjeta, **efectivo en OXXO**, transferencia SPEI o
  cuenta de Mercado Pago. Para OXXO/SPEI se genera una ficha (`/pedidos/<id>`) con referencia, monto y fecha
  límite; si no se paga a tiempo el pedido expira y las piezas regresan al inventario.
- **Modo simulado** (`MP_MODO=simulado`, el valor por defecto): todas las pantallas funcionan **sin** llamar a
  Mercado Pago. En tarjeta el pedido se confirma como simulado, sin ingresar datos de tarjeta; en OXXO/SPEI el botón
  "Simular pago recibido" marca el pedido como pagado.
- **Cobrar de verdad (incluye OXXO)**: la integración con Mercado Pago ya está hecha. Solo llena
  `MP_ACCESS_TOKEN` (y, si quieres confirmación inmediata de pagos en OXXO/SPEI, `BACKEND_PUBLIC_URL` +
  `MP_WEBHOOK_SECRET`) en `backend-practica-6-2/.env`, `PUBLIC_MP_PUBLIC_KEY` en `baking-hub-front/.env`, y cambia
  `MP_MODO=real`. Configura también `FRONTEND_URL` con la URL HTTPS pública de Astro (por ejemplo, la URL ngrok del
  puerto 4321): Checkout Pro regresará a `/pedidos/<id>` y volverá automáticamente cuando Mercado Pago apruebe el pago.
  Si ese túnel solo apunta a Astro, deja `BACKEND_PUBLIC_URL` vacío; para webhooks inmediatos se necesita otro túnel
  público al backend (puerto 4000). Sin webhook, el backend consulta a Mercado Pago cada 5 minutos por los pagos pendientes.
  El webhook es `POST /webhooks/mercadopago` (valida la firma `x-signature` y consulta el estado real del pago).
  Claves de prueba (`TEST-…`) y de producción (`APP_USR-…`) no se mezclan: usa el par del mismo entorno.
- **Panel admin** (`/admin`, solo rol `admin`): resumen, **inventario** (agregar productos, reabastecer,
  editar, eliminar) y **clientes** (buscar, editar, suspender/reactivar, eliminar). Para ser admin, pon tu
  correo en `ADMIN_EMAIL` del `.env` del backend y regístrate con él.
- **Inventario**: cada pedido aparta las piezas; si el pago falla, se cancela o expira, se devuelven. Al
  arrancar, el backend agrega solo las columnas nuevas a una base existente (los productos viejos quedan con
  20 piezas), así que no necesitas volver a cargar `db.sql`.
- Después de actualizar, corre `npm install` en `backend-practica-6-2` (se agregaron `express` y
  `@as-integrations/express5`).

## 1. Instalar PostgreSQL, Node.js y npm

```bash
sudo pacman -Syu postgresql nodejs npm
```

## 2. Inicializar PostgreSQL (solo la primera vez que lo instalas)

```bash
sudo -iu postgres initdb -D /var/lib/postgres/data
sudo systemctl enable --now postgresql
```

## 3. Crear el usuario y la base de datos

Entra a la consola de Postgres como el usuario del sistema `postgres`:

```bash
sudo -iu postgres psql
```

Dentro de `psql`, define una contraseña para el usuario `postgres` (usa la
que quieras, solo recuérdala) y crea la base de datos:

```sql
ALTER USER postgres WITH PASSWORD 'postgres';
CREATE DATABASE bakinghub;
\q
```

## 4. Cargar las tablas y datos de ejemplo

Desde la carpeta del proyecto:

```bash
cd backend-practica-6-2
PGPASSWORD=postgres psql -U postgres -h localhost -d bakinghub -f db.sql
```

Esto crea las tablas `productos`, `pedidos`, `pedido_productos` y mete 4
productos de ejemplo.

## 5. Configurar las variables de entorno del backend

```bash
cd backend-practica-6-2
cp .env.example .env
```

Abre `.env` y completa:

- `DB_PASSWORD`: la contraseña que definiste en el paso 3 (si usaste `postgres`, ya está bien).
- `JWT_SECRET` (**obligatorio**, mínimo 32 caracteres). Genera uno con:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- `ADMIN_EMAIL` (opcional): quien se registre con ese correo será `admin`.

> Si ya habías cargado el `db.sql` anterior no necesitas volver a cargarlo: al arrancar, el backend
> crea la tabla `usuarios` y las columnas nuevas por sí solo (`usuario_id` en `pedidos` y
> `cantidad` en `pedido_productos`).

## 6. Instalar dependencias y levantar el backend

```bash
npm install
npm run dev
```

Deberías ver algo como:

```
✅ Conexión a PostgreSQL exitosa
Servidor listo en http://0.0.0.0:4000/
```

Si en vez de eso ves `❌ No se pudo conectar a PostgreSQL`, revisa que:
- `systemctl status postgresql` diga `active (running)`.
- La contraseña en `.env` sea igual a la que pusiste en el paso 3.
- La base `bakinghub` exista (`sudo -iu postgres psql -l`).

Si ves `❌ Falta JWT_SECRET`, completa ese valor en `.env` (paso 5).

## 7. Levantar el frontend (en otra terminal)

```bash
cd baking-hub-front
cp .env.example .env
npm install
npm run dev
```

Astro te dará la URL `http://localhost:4321/`. Ábrela en el navegador: verás el catálogo
cargando los productos desde el backend. Crea una cuenta en **Crear cuenta** para poder pagar.

## Notas

- Si cambias el `PORT` del backend en `.env`, actualiza `GRAPHQL_URL` en `baking-hub-front/.env`.
- Para servir el build de producción: `npm run build && npm start`. La cookie de sesión es `Secure`
  en producción, así que necesita HTTPS (en `localhost` los navegadores lo permiten, en una IP de
  red local no).
- El carrito se guarda en el navegador (`localStorage`); el pedido se crea en el servidor al pagar.
- Cada vez que reinicies tu laptop necesitas que PostgreSQL esté corriendo:
  `sudo systemctl start postgresql` (o usa `enable` como arriba para que arranque solo).

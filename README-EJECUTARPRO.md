# 🧁 Baking Hub - Guía de Configuración y Ejecución

Este repositorio contiene el sistema de comercio electrónico de **Baking
Hub**, estructurado en un frontend con Astro/React y un backend con
Node.js/Express integrado con **Mercado Pago (Secure Fields API)**.

------------------------------------------------------------------------

## 🛠️ Requisitos Previos

Antes de comenzar, asegúrate de tener instalado:

-   [Node.js](https://nodejs.org/) (Versión 18 o superior)
-   `npm` (incluido con Node.js)
-   Una cuenta de desarrollador en [Mercado Pago
    Developers](https://www.mercadopago.com.mx/developers)

------------------------------------------------------------------------

## 📁 Estructura del Proyecto

``` text
practica-6-2/
├── baking-hub-front/       # Aplicación Frontend (Astro + React)
└── backend-practica-6-2/  # Servidor Backend (Node.js + Express)
```

## ⚙️ Paso 1: Configuración de Variables de Entorno (`.env`)

Debes crear un archivo `.env` en cada carpeta del proyecto.

Para una presentación sin credenciales, conserva `MP_MODO=simulado` en el backend (es el modo por
defecto): tarjeta se confirma como simulada y OXXO/SPEI generan una referencia de prueba. No se
realizan cobros reales ni se deben presentar esas referencias como válidas en una tienda.

### 1. Frontend (`baking-hub-front/.env`)

Crea un archivo `.env` dentro de la carpeta `baking-hub-front/`:

``` env
GRAPHQL_URL=http://localhost:4000/
GRAPHQL_WS_URL=ws://localhost:4000/subscriptions
PUBLIC_MP_PUBLIC_KEY=TEST-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

> **Nota:** La clave pública debe ser la **Public Key de prueba**
> obtenida en el panel de desarrolladores de Mercado Pago.
> Para desarrollo local, conserva las dos URLs de GraphQL como están; no hace falta ngrok ni otro
> servicio externo para que la suscripción funcione.

### 2. Backend (`backend-practica-6-2/.env`)

Crea un archivo `.env` dentro de la carpeta `backend-practica-6-2/`:

``` env
PORT=4000
MP_MODO=real
MP_ACCESS_TOKEN=TEST-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MP_TEST_PAYER_EMAIL=correo-de-la-cuenta-compradora-de-prueba
MP_WEBHOOK_SECRET=xxxxxxxxxxxxxxxx
BACKEND_PUBLIC_URL=https://url-publica-del-backend.example
FRONTEND_URL=https://url-publica-de-astro.example
```

`FRONTEND_URL` debe ser la URL HTTPS pública de Astro para que Mercado Pago vuelva al pedido y
redirija automáticamente después de aprobar el pago. Si ngrok apunta solo al frontend, no uses esa
misma URL como `BACKEND_PUBLIC_URL`: esa variable debe apuntar a un túnel del backend (puerto 4000).
Si no tienes ese segundo túnel, deja `BACKEND_PUBLIC_URL` vacío; el backend consultará los pagos pendientes
cada cinco minutos.

> ⚠️ **IMPORTANTE:**
>
> -   **Coincidencia de credenciales:** El `MP_ACCESS_TOKEN` y la
>     `PUBLIC_MP_PUBLIC_KEY` **deben ser ambos de PRUEBA** (`TEST-...`).
>     Si mezclas credenciales de producción (`APP_USR-...`) con datos de
>     prueba, Mercado Pago arrojará el error
>     `Unauthorized use of live credentials`.
>
> -   **Cuentas de prueba:** No utilices la misma cuenta que generó las
>     credenciales para intentar comprar en el sitio. Mercado Pago no
>     permite compras a uno mismo ("autocobro").
>     `MP_TEST_PAYER_EMAIL` debe ser el correo de una cuenta compradora de prueba
>     creada para esta integración; no uses `test@testuser.com`.
>
> -   **Webhooks OXXO/SPEI:** para confirmar pagos inmediatamente, `BACKEND_PUBLIC_URL`
>     debe ser HTTPS y accesible públicamente. Configura esa URL junto con
>     `MP_WEBHOOK_SECRET` en Mercado Pago. Sin webhook, el backend concilia los
>     pagos pendientes consultando Mercado Pago cada cinco minutos.

## 🚀 Paso 2: Instalación de Dependencias

Ejecuta el siguiente proceso para ambas carpetas en la terminal:

### 1. En el Backend:

``` bash
cd backend-practica-6-2
npm install
```

### 2. En el Frontend:

``` bash
cd ../baking-hub-front
npm install
```

## 🏃‍♂️ Paso 3: Levantar el Proyecto

Para probar el flujo completo de compra, **ambos servidores deben estar
ejecutándose simultáneamente en terminales separadas**.

### Terminal 1: Backend

``` bash
cd backend-practica-6-2
npm run dev
# o
node index.js
```

*El servidor backend iniciará en `http://localhost:4000` (o el puerto
configurado).*

### Terminal 2: Frontend

``` bash
cd baking-hub-front
npm run dev
```

*El frontend estará disponible en `http://localhost:4321`.*

## 🔔 Actualización en tiempo real del panel admin

Cuando un pago cambia a `pagado`, el backend publica `pedidoPagado` mediante GraphQL sobre WebSocket
(`ws://localhost:4000/subscriptions`). El panel `/admin` escucha el evento y vuelve a consultar su
resumen; los pedidos pendientes no se cuentan como ventas. La misma ruta cubre pagos simulados,
webhooks y la conciliación periódica de Mercado Pago.

En `/admin/usuarios`, la columna **Online** muestra si cada cliente está navegando con una pestaña
visible: el navegador envía una señal cada 20 segundos y se marca como desconectado tras 50 segundos
sin señal. Los cambios se difunden por `usuarioPresenciaActualizada`. El estado se guarda en memoria,
así que está pensado para ejecutar una sola instancia del backend.

En local basta con tener backend y frontend ejecutándose. Para que un frontend remoto se conecte,
configura `GRAPHQL_WS_URL` en `baking-hub-front/.env` con la URL `wss://` pública del backend y la
ruta `/subscriptions`. Un túnel como ngrok solo hace falta si necesitas que servicios externos
lleguen al backend (por ejemplo, el webhook de Mercado Pago); no es necesario para probar esta
suscripción en tu propia máquina.

## 💳 Pruebas de Pago

Para probar el flujo de checkout sin hacer cargos reales:

1.  Ingresa a la aplicación desde tu navegador
    (`http://localhost:4321`).
2.  Agrega productos al carrito e inicia el proceso de pago.
3.  Utiliza una **tarjeta de prueba oficial** suministrada en la
    [documentación de Mercado
    Pago](https://www.mercadopago.com.mx/developers/es/docs/checkout-api/landing/test-cards).
4.  En modo real, inicia sesión con un correo electrónico **diferente**
    al correo dueño de la cuenta de Mercado Pago. En modo simulado no se
    necesitan tarjetas ni credenciales.

## 🚨 Solución de Problemas Frecuentes

-   `502 Bad Gateway` **al hacer el pago:** Revisa el log de la Terminal 1
    (backend). Si muestra `401: invalid access token`, reemplaza
    `MP_ACCESS_TOKEN` en `backend-practica-6-2/.env` por un Access Token
    vigente de la aplicación correcta y reinicia el backend. No uses la clave
    pública como Access Token ni publiques el valor.

-   `Unauthorized use of live credentials`: Asegúrate de estar usando un
    `MP_ACCESS_TOKEN` de prueba (`TEST-...`) y no uno de producción
    (`APP_USR-...`).

-   **Los campos de la tarjeta no cargan en modo real:** Revisa que
    `PUBLIC_MP_PUBLIC_KEY` corresponda al `MP_ACCESS_TOKEN`, que hayas
    reiniciado Astro y que tengas conexión a `sdk.mercadopago.com`.

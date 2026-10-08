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

### 1. Frontend (`baking-hub-front/.env`)

Crea un archivo `.env` dentro de la carpeta `baking-hub-front/`:

``` env
PUBLIC_MP_PUBLIC_KEY=TEST-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

> **Nota:** La clave pública debe ser la **Public Key de prueba**
> obtenida en el panel de desarrolladores de Mercado Pago.

### 2. Backend (`backend-practica-6-2/.env`)

Crea un archivo `.env` dentro de la carpeta `backend-practica-6-2/`:

``` env
PORT=3000
MP_ACCESS_TOKEN=TEST-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

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

*El servidor backend iniciará en `http://localhost:3000` (o el puerto
configurado).*

### Terminal 2: Frontend

``` bash
cd baking-hub-front
npm run dev
```

*El frontend estará disponible en `http://localhost:4321`.*

## 💳 Pruebas de Pago

Para probar el flujo de checkout sin hacer cargos reales:

1.  Ingresa a la aplicación desde tu navegador
    (`http://localhost:4321`).
2.  Agrega productos al carrito e inicia el proceso de pago.
3.  Utiliza una **tarjeta de prueba oficial** suministrada en la
    [documentación de Mercado
    Pago](https://www.mercadopago.com.mx/developers/es/docs/checkout-api/landing/test-cards).
4.  Asegúrate de iniciar sesión en la app con un correo electrónico
    **diferente** al correo dueño de la cuenta de Mercado Pago.

## 🚨 Solución de Problemas Frecuentes

-   `502 Bad Gateway` **al hacer el pago:** Verifica que el backend esté
    ejecutándose en la Terminal 1 y respondiendo a las peticiones del
    frontend.

-   `Unauthorized use of live credentials`: Asegúrate de estar usando un
    `MP_ACCESS_TOKEN` de prueba (`TEST-...`) y no uno de producción
    (`APP_USR-...`).

-   **Los campos de la tarjeta no cargan:** Revisa que
    `PUBLIC_MP_PUBLIC_KEY` esté bien declarada en el `.env` del frontend
    y que hayas reiniciado el servidor Vite después de modificarla.

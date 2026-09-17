# Cómo ejecutar Baking Hub en Arch Linux

Este proyecto tiene dos partes que deben correr **al mismo tiempo**, en dos terminales
distintas:

- `backend-practica-6-2/` → servidor GraphQL (Apollo Server + PostgreSQL), puerto **4000**
- `baking-hub-front/` → frontend en React + Vite, puerto **5173**

## Qué se arregló

El backend tenía las credenciales de PostgreSQL **quemadas en el código**
(`user: 'postgres'`, `password: '270805'`, etc.), que eran las de la máquina
original del proyecto. En tu laptop esas credenciales casi seguro no existen,
así que la conexión a la base de datos fallaba silenciosamente y el GraphQL
nunca devolvía productos. Ahora:

- Las credenciales se leen de un archivo `.env` (con `dotenv`).
- Si la conexión falla al arrancar, el servidor te lo dice explícitamente en
  la terminal en vez de fallar en silencio.

El frontend (React 19 + Vite + Apollo Client 4) ya compilaba sin errores —
no necesitaba cambios de código, solo necesita que el backend esté arriba y
respondiendo.

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
cp .env.example .env
```

Abre `.env` y pon la contraseña que definiste en el paso 3 (si usaste
`postgres` como en el ejemplo, no necesitas cambiar nada).

## 6. Instalar dependencias y levantar el backend

```bash
npm install
npm run dev
```

Deberías ver algo como:

```
✅ Conexión a PostgreSQL exitosa
Servidor listo en http://localhost:4000/
```

Si en vez de eso ves `❌ No se pudo conectar a PostgreSQL`, revisa que:
- `systemctl status postgresql` diga `active (running)`.
- La contraseña en `.env` sea igual a la que pusiste en el paso 3.
- La base `bakinghub` exista (`sudo -iu postgres psql -l`).

## 7. Levantar el frontend (en otra terminal)

```bash
cd baking-hub-front
npm install
npm run dev
```

Vite te dará una URL, normalmente `http://localhost:5173/`. Ábrela en el
navegador — deberías ver el catálogo de Baking Hub cargando los productos
desde el backend.

## Notas

- El frontend apunta a `http://localhost:4000/` (hardcodeado en
  `src/main.jsx`). Si cambias el `PORT` del backend en `.env`, actualiza
  también esa URL.
- Cada vez que reinicies tu laptop necesitas que PostgreSQL esté corriendo:
  `sudo systemctl start postgresql` (o usa `enable` como arriba para que
  arranque solo).

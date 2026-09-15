# Baking Hub

Aplicacion web de una pasteleria para consultar productos, filtrarlos por categoria, agregarlos al carrito y crear pedidos. El proyecto utiliza React, Vite, Apollo Client, GraphQL, Node.js y PostgreSQL.

## Estructura del proyecto

La practica esta dividida en dos servicios:

```text
Practica 6-2/
|-- backend-practica-6-2/   API GraphQL y conexion a PostgreSQL
|   |-- db.sql              Tablas y productos iniciales
|   |-- index.js             Servidor Apollo
|   `-- package.json
`-- baking-hub-front/        Aplicacion React con Vite
		|-- src/
		|-- package.json
		`-- README.md
```

## Requisitos

- Node.js 20 o superior y npm.
- PostgreSQL instalado y ejecutandose en el puerto `5432`.
- Una terminal para ejecutar el backend y otra para ejecutar el frontend.

Puedes comprobar Node.js y npm con:

```bash
node --version
npm --version
```

## Instalacion

Los siguientes comandos parten de la carpeta `Practica 6-2`.

### 1. Crear la base de datos

En PostgreSQL crea una base de datos llamada `bakinghub` usando pgAdmin o `psql`:

```sql
CREATE DATABASE bakinghub;
```

Despues, carga las tablas y los productos de ejemplo desde la carpeta del backend:

```bash
cd backend-practica-6-2
psql -U postgres -d bakinghub -f db.sql
```

Si utilizas pgAdmin, abre `db.sql` conectado a la base `bakinghub`, ejecuta todo el archivo y confirma que se hayan creado las tablas `productos`, `pedidos` y `pedido_productos`.

El backend esta configurado para conectarse con estos datos locales:

| Dato | Valor |
| --- | --- |
| Usuario | `postgres` |
| Base de datos | `bakinghub` |
| Host | `localhost` |
| Puerto | `5432` |
| Contrasena | `270805` |

Si la contrasena de PostgreSQL es diferente, actualiza el valor `password` en `backend-practica-6-2/index.js` antes de iniciar el servidor.

### 2. Instalar dependencias del backend

Desde `Practica 6-2/backend-practica-6-2` ejecuta:

```bash
npm install
```

### 3. Instalar dependencias del frontend

Abre otra terminal y ejecuta:

```bash
cd baking-hub-front
npm install
```

## Ejecucion

### 1. Iniciar el backend

Desde `Practica 6-2/backend-practica-6-2`:

```bash
npm start
```

La API GraphQL quedara disponible en:

```text
http://localhost:4000/
```

Debe aparecer en la terminal el mensaje `Servidor listo en http://localhost:4000/`.

Para desarrollo, el backend tambien puede ejecutarse con reinicio automatico:

```bash
npm run dev
```

### 2. Iniciar el frontend

Desde `Practica 6-2/baking-hub-front`:

```bash
npm run dev
```

Abre en el navegador la URL que muestre Vite, normalmente:

```text
http://localhost:5173/
```

El backend debe estar activo antes de abrir el frontend. La aplicacion React consume GraphQL desde `http://localhost:4000/`.

## Funcionalidades para evaluar

1. Verificar que el catalogo cargue los productos registrados en PostgreSQL.
2. Cambiar entre las categorias `Ver Todo`, `Chocolates` y `Panaderia`.
3. Abrir el detalle de un producto y agregarlo al carrito.
4. Revisar el carrito y avanzar al checkout.
5. Confirmar el pedido y comprobar que aparezca un mensaje con el ID y total del pedido.
6. Revisar en PostgreSQL que se haya creado un registro en `pedidos` y sus relaciones en `pedido_productos`.

## Operaciones GraphQL

El backend expone estas operaciones en `http://localhost:4000/`:

```graphql
query {
	productos {
		id
		nombre
		precio
		imagen
	}
}
```

```graphql
mutation {
	crearPedido(productos: ["1", "2"]) {
		id
		total
		status
	}
}
```

Tambien estan disponibles las mutaciones `crearProducto(nombre, precio, imagen)` y `eliminarProducto(id)` para probar la API desde Apollo Sandbox.

## Comandos de validacion

Desde `baking-hub-front`:

```bash
npm run lint
npm run build
```

`npm run lint` revisa el codigo y `npm run build` genera la version de produccion en `dist/`. El proyecto no incluye pruebas automatizadas; la validacion funcional se realiza con el flujo descrito arriba y las operaciones GraphQL.

## Solucion de problemas

- **Error de conexion con PostgreSQL:** confirma que el servicio este iniciado, que exista la base `bakinghub` y que los datos de conexion de `index.js` coincidan con tu instalacion.
- **El catalogo no carga:** confirma que el backend este ejecutandose en el puerto `4000` y que `db.sql` se haya ejecutado correctamente.
- **El puerto esta ocupado:** cierra el proceso que lo utiliza o cambia el puerto del backend y la URL de `HttpLink` en `src/main.jsx` para que coincidan.
- **`npm` no reconoce un comando:** instala Node.js y vuelve a abrir la terminal para actualizar el `PATH`.

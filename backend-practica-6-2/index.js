import 'dotenv/config';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import express from 'express';
import http from 'node:http';
import { GraphQLError } from 'graphql';
import pkg from 'pg';
import {
  errorDeUsuario,
  errorNoAutenticado,
  errorProhibido,
  firmarToken,
  hashPassword,
  idDesdeRequest,
  validarRegistro,
  verificarPassword,
} from './auth.js';
import {
  HORAS_PARA_PAGAR,
  METODOS_ACTIVOS,
  MODO,
  consultarPago,
  crearCobro,
  verificarFirmaWebhook,
} from './pagos.js';

const { Pool } = pkg;
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'bakinghub',
  password: process.env.DB_PASSWORD || 'postgres',
  port: Number(process.env.DB_PORT) || 5432,
});

// Verifica la conexión a la base de datos al arrancar, para dar un mensaje
// claro en vez de que los primeros queries fallen sin explicación.
try {
  await pool.query('SELECT 1');
  console.log('✅ Conexión a PostgreSQL exitosa');
} catch (err) {
  console.error('❌ No se pudo conectar a PostgreSQL:', err.message);
  console.error(
    '   Revisa que Postgres esté corriendo y que las variables en tu archivo .env sean correctas\n' +
    '   (DB_USER, DB_PASSWORD, DB_NAME, DB_HOST, DB_PORT). Ver el README para más detalles.'
  );
}

// Cambios de esquema para la autenticación. Son idempotentes: si ya cargaste el
// db.sql actualizado (o ya arrancaste antes el servidor) no hacen nada.
try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL,
      email VARCHAR(254) NOT NULL UNIQUE,
      password_hash VARCHAR(100) NOT NULL,
      rol VARCHAR(20) NOT NULL DEFAULT 'cliente',
      creado TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS usuario_id INT REFERENCES usuarios(id) ON DELETE SET NULL;
    ALTER TABLE pedido_productos ADD COLUMN IF NOT EXISTS cantidad INT NOT NULL DEFAULT 1;

    -- Inventario: los productos que ya existían quedan con 20 piezas; ajústalo desde el panel de admin.
    ALTER TABLE productos ADD COLUMN IF NOT EXISTS stock INT NOT NULL DEFAULT 20 CHECK (stock >= 0);
    ALTER TABLE productos ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;

    -- Gestión de clientes: una cuenta suspendida no puede iniciar sesión.
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;

    -- Pagos (Mercado Pago): método elegido y datos del cobro.
    ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS metodo_pago VARCHAR(20);
    ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS pago_id VARCHAR(100);
    ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS pago_referencia VARCHAR(100);
    ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS pago_url TEXT;
    ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS pago_expira TIMESTAMPTZ;
    ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS pagado_en TIMESTAMPTZ;
    CREATE INDEX IF NOT EXISTS pedidos_pago_id_idx ON pedidos (pago_id);
  `);
} catch (err) {
  console.error('❌ No se pudo preparar el esquema de la base de datos:', err.message);
  console.error('   ¿Ya cargaste db.sql? (crea las tablas productos, pedidos y pedido_productos)');
}

const TypeDefs = `#graphql
type Producto {
  id: ID!
  nombre: String!
  precio: Float!
  imagen: String!
  stock: Int!
}

type Usuario {
  id: ID!
  nombre: String!
  email: String!
  rol: String!
}

type UsuarioAdmin {
  id: ID!
  nombre: String!
  email: String!
  rol: String!
  activo: Boolean!
  creado: String!
  pedidos: Int!
  totalComprado: Float!
}

type AuthPayload {
  token: String!
  usuario: Usuario!
}

type ItemPedido {
  id: ID!
  nombre: String!
  precio: Float!
  cantidad: Int!
}

type Pedido {
  id: ID!
  total: Float!
  status: String!
  fecha: String!
  productos: [ItemPedido!]!
  metodoPago: String
  pagoReferencia: String
  pagoUrl: String
  pagoExpira: String
}

type ConfigPagos {
  modo: String!
  metodos: [String!]!
  horasParaPagar: Int!
}

type ResumenAdmin {
  productos: Int!
  sinStock: Int!
  stockBajo: Int!
  clientes: Int!
  clientesSuspendidos: Int!
  pedidosPendientes: Int!
  pedidosPagados: Int!
  ventas: Float!
}

input TarjetaInput {
  token: String!
  paymentMethodId: String
  issuerId: String
  cuotas: Int
}

type Query {
  productos: [Producto]
  producto(id: ID!): Producto
  me: Usuario
  misPedidos: [Pedido!]!
  pedido(id: ID!): Pedido
  configPagos: ConfigPagos!

  adminResumen: ResumenAdmin!
  adminProductos: [Producto!]!
  adminUsuarios(busqueda: String): [UsuarioAdmin!]!
}

type Mutation {
  registrar(nombre: String!, email: String!, password: String!): AuthPayload!
  login(email: String!, password: String!): AuthPayload!

  crearPedido(productos: [ID!]!, metodoPago: String!, tarjeta: TarjetaInput): Pedido
  simularPago(pedidoId: ID!): Pedido

  crearProducto(nombre: String!, precio: Float!, imagen: String!, stock: Int = 0): Producto
  actualizarProducto(id: ID!, nombre: String!, precio: Float!, imagen: String!, stock: Int!): Producto
  ajustarStock(id: ID!, cantidad: Int!): Producto
  eliminarProducto(id: ID!): String

  actualizarUsuario(id: ID!, nombre: String!, email: String!): UsuarioAdmin
  cambiarEstadoUsuario(id: ID!, activo: Boolean!): UsuarioAdmin
  eliminarUsuario(id: ID!): String
}
`;

const requiereLogin = (ctx) => {
  if (!ctx.usuario) throw errorNoAutenticado();
  return ctx.usuario;
};

const requiereAdmin = (ctx) => {
  const usuario = requiereLogin(ctx);
  if (usuario.rol !== 'admin') throw errorProhibido();
  return usuario;
};

const USUARIO_PUBLICO = 'id, nombre, email, rol';
const STOCK_BAJO = 5;

/** Convierte un id de GraphQL en entero o lanza un error claro. */
function idEntero(id) {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) throw errorDeUsuario('El identificador no es válido');
  return n;
}

/** Valida y limpia los datos de un producto (los usa el panel de admin). */
function validarProducto({ nombre, precio, imagen, stock }) {
  nombre = nombre.trim();
  imagen = imagen.trim();
  if (nombre.length < 1 || nombre.length > 100) throw errorDeUsuario('El nombre debe tener entre 1 y 100 caracteres');
  if (!Number.isFinite(precio) || precio <= 0 || precio > 1_000_000) throw errorDeUsuario('El precio debe ser mayor a 0');
  if (imagen.length > 255 || !/^(https?:\/\/|\/(?![/\\]))/i.test(imagen)) {
    throw errorDeUsuario('La imagen debe ser una URL (http o https) de máximo 255 caracteres');
  }
  if (!Number.isInteger(stock) || stock < 0 || stock > 100_000) throw errorDeUsuario('El stock debe ser un entero entre 0 y 100000');
  return { nombre, precio: Math.round(precio * 100) / 100, imagen, stock };
}

/* ------------------------------------------------------------------------------------------------
 * Pedidos y pagos
 * -----------------------------------------------------------------------------------------------*/

/**
 * Cancela (o expira) un pedido que sigue pendiente y devuelve al inventario las piezas reservadas.
 * Es idempotente: si el pedido ya no está pendiente no hace nada.
 */
async function cancelarPedido(pedidoId, nuevoEstado = 'cancelado') {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await client.query("UPDATE pedidos SET status = $2 WHERE id = $1 AND status = 'pendiente' RETURNING id", [pedidoId, nuevoEstado]);
    if (res.rowCount > 0) {
      await client.query(
        `UPDATE productos p SET stock = p.stock + pp.cantidad
           FROM pedido_productos pp
          WHERE pp.pedido_id = $1 AND pp.producto_id = p.id`,
        [pedidoId]
      );
    }
    await client.query('COMMIT');
    return res.rowCount > 0;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** Aplica al pedido el estado de un pago (lo usan el webhook y el modo simulado). */
async function aplicarEstadoPago(pedidoId, estado, pagoId = null) {
  switch (estado) {
    case 'pagado': {
      const res = await pool.query(
        `UPDATE pedidos SET status = 'pagado', pagado_en = NOW(), pago_id = COALESCE($2, pago_id)
          WHERE id = $1 AND status = 'pendiente'`,
        [pedidoId, pagoId]
      );
      if (res.rowCount === 0) console.warn(`Pago recibido para el pedido ${pedidoId}, pero ya no estaba pendiente. Revísalo a mano.`);
      return;
    }
    case 'rechazado':
    case 'cancelado':
      await cancelarPedido(pedidoId, 'cancelado');
      return;
    case 'expirado':
      await cancelarPedido(pedidoId, 'expirado');
      return;
    case 'reembolsado':
      await pool.query("UPDATE pedidos SET status = 'reembolsado' WHERE id = $1 AND status = 'pagado'", [pedidoId]);
      return;
    default:
      return; // 'pendiente': no hay nada que cambiar
  }
}

/** Respaldo local: libera el stock de pedidos de OXXO/SPEI que nadie pagó (1 h de gracia sobre la fecha límite). */
async function expirarPedidosVencidos() {
  const res = await pool.query(
    "SELECT id FROM pedidos WHERE status = 'pendiente' AND pago_expira IS NOT NULL AND pago_expira < NOW() - INTERVAL '1 hour'"
  );
  for (const { id } of res.rows) await cancelarPedido(id, 'expirado');
  if (res.rowCount > 0) console.log(`Pedidos expirados: ${res.rowCount}`);
}

const resolvers = {
  Query: {
    productos: async () => {
      try {
        const res = await pool.query('SELECT * FROM productos WHERE activo ORDER BY id');
        return res.rows;
      } catch (error) {
        console.error('Error al obtener productos:', error);
        throw new Error('Error al obtener productos');
      }
    },
    producto: async (_, { id }) => {
      const n = Number(id);
      if (!Number.isInteger(n)) return null;
      const res = await pool.query('SELECT * FROM productos WHERE id = $1 AND activo', [n]);
      return res.rows[0] ?? null;
    },
    me: (_, __, ctx) => ctx.usuario,
    misPedidos: async (_, __, ctx) => {
      const usuario = requiereLogin(ctx);
      const res = await pool.query('SELECT * FROM pedidos WHERE usuario_id = $1 ORDER BY fecha DESC, id DESC', [usuario.id]);
      return res.rows;
    },
    pedido: async (_, { id }, ctx) => {
      const usuario = requiereLogin(ctx);
      const n = Number(id);
      if (!Number.isInteger(n)) return null;
      const res = await pool.query('SELECT * FROM pedidos WHERE id = $1 AND (usuario_id = $2 OR $3::boolean)', [n, usuario.id, usuario.rol === 'admin']);
      return res.rows[0] ?? null;
    },
    configPagos: () => ({ modo: MODO, metodos: METODOS_ACTIVOS, horasParaPagar: HORAS_PARA_PAGAR }),

    adminResumen: async (_, __, ctx) => {
      requiereAdmin(ctx);
      const { rows } = await pool.query(
        `SELECT
           (SELECT COUNT(*) FROM productos WHERE activo)::int AS productos,
           (SELECT COUNT(*) FROM productos WHERE activo AND stock = 0)::int AS sin_stock,
           (SELECT COUNT(*) FROM productos WHERE activo AND stock BETWEEN 1 AND $1)::int AS stock_bajo,
           (SELECT COUNT(*) FROM usuarios WHERE rol = 'cliente')::int AS clientes,
           (SELECT COUNT(*) FROM usuarios WHERE rol = 'cliente' AND NOT activo)::int AS clientes_suspendidos,
           (SELECT COUNT(*) FROM pedidos WHERE status = 'pendiente')::int AS pedidos_pendientes,
           (SELECT COUNT(*) FROM pedidos WHERE status = 'pagado')::int AS pedidos_pagados,
           (SELECT COALESCE(SUM(total), 0) FROM pedidos WHERE status = 'pagado') AS ventas`,
        [STOCK_BAJO]
      );
      const r = rows[0];
      return {
        productos: r.productos,
        sinStock: r.sin_stock,
        stockBajo: r.stock_bajo,
        clientes: r.clientes,
        clientesSuspendidos: r.clientes_suspendidos,
        pedidosPendientes: r.pedidos_pendientes,
        pedidosPagados: r.pedidos_pagados,
        ventas: r.ventas,
      };
    },
    adminProductos: async (_, __, ctx) => {
      requiereAdmin(ctx);
      const res = await pool.query('SELECT * FROM productos WHERE activo ORDER BY id');
      return res.rows;
    },
    adminUsuarios: async (_, { busqueda }, ctx) => {
      requiereAdmin(ctx);
      const termino = (busqueda ?? '').trim().slice(0, 100);
      const patron = `%${termino.replace(/[\\%_]/g, '\\$&')}%`;
      const res = await pool.query(
        `SELECT u.id, u.nombre, u.email, u.rol, u.activo, u.creado,
                COUNT(p.id)::int AS pedidos,
                COALESCE(SUM(p.total) FILTER (WHERE p.status = 'pagado'), 0) AS total_comprado
           FROM usuarios u LEFT JOIN pedidos p ON p.usuario_id = u.id
          WHERE u.rol = 'cliente' AND ($1 = '' OR u.nombre ILIKE $2 OR u.email ILIKE $2)
          GROUP BY u.id
          ORDER BY u.creado DESC, u.id DESC`,
        [termino, patron]
      );
      return res.rows;
    },
  },

  UsuarioAdmin: {
    creado: (u) => new Date(u.creado).toISOString(),
    totalComprado: (u) => u.total_comprado ?? 0,
  },

  Pedido: {
    fecha: (pedido) => new Date(pedido.fecha).toISOString(),
    metodoPago: (pedido) => pedido.metodo_pago ?? null,
    pagoReferencia: (pedido) => pedido.pago_referencia ?? null,
    pagoUrl: (pedido) => pedido.pago_url ?? null,
    pagoExpira: (pedido) => (pedido.pago_expira ? new Date(pedido.pago_expira).toISOString() : null),
    productos: async (pedido) => {
      const res = await pool.query(
        `SELECT p.id, p.nombre, p.precio, pp.cantidad
           FROM pedido_productos pp JOIN productos p ON p.id = pp.producto_id
          WHERE pp.pedido_id = $1 ORDER BY p.id`,
        [pedido.id]
      );
      return res.rows;
    },
  },

  Mutation: {
    registrar: async (_, args) => {
      const { nombre, email, password } = validarRegistro(args);
      // Quien se registre con ADMIN_EMAIL obtiene rol admin (regístrate tú primero con ese correo).
      const esAdmin = process.env.ADMIN_EMAIL && email === process.env.ADMIN_EMAIL.trim().toLowerCase();
      const hash = await hashPassword(password);
      try {
        const res = await pool.query(
          `INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES ($1, $2, $3, $4) RETURNING ${USUARIO_PUBLICO}`,
          [nombre, email, hash, esAdmin ? 'admin' : 'cliente']
        );
        const usuario = res.rows[0];
        return { token: firmarToken(usuario), usuario };
      } catch (error) {
        if (error.code === '23505') throw errorDeUsuario('Ese correo ya está registrado');
        console.error('Error al registrar usuario:', error);
        throw new Error('Error al registrar usuario');
      }
    },

    login: async (_, { email, password }) => {
      const res = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email.trim().toLowerCase()]);
      const fila = res.rows[0];
      const passwordOk = await verificarPassword(password, fila?.password_hash);
      if (!fila || !passwordOk) throw errorNoAutenticado('Correo o contraseña incorrectos');
      // Se revisa después de la contraseña para no revelar a desconocidos qué correos existen.
      if (!fila.activo) throw errorNoAutenticado('Tu cuenta está suspendida. Contacta a la tienda para reactivarla.');
      const { password_hash, ...usuario } = fila;
      return { token: firmarToken(usuario), usuario };
    },

    crearPedido: async (_, { productos, metodoPago, tarjeta }, ctx) => {
      const usuario = requiereLogin(ctx);
      if (productos.length === 0 || productos.length > 500) throw errorDeUsuario('El carrito no es válido');

      const metodo = metodoPago.trim().toLowerCase();
      if (!METODOS_ACTIVOS.includes(metodo)) throw errorDeUsuario('Ese método de pago no está disponible');
      if (metodo === 'tarjeta' && !tarjeta?.token) throw errorDeUsuario('Falta la información de la tarjeta');

      // Los ids repetidos cuentan como cantidad: ["1","1","3"] => 2 x producto 1, 1 x producto 3.
      const cantidades = new Map();
      for (const raw of productos) {
        const id = Number(raw);
        if (!Number.isInteger(id)) throw errorDeUsuario('El carrito contiene un producto inválido');
        cantidades.set(id, (cantidades.get(id) ?? 0) + 1);
      }

      // 1) Crear el pedido y APARTAR las piezas del inventario (todo en una transacción).
      let pedido;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const encontrados = await client.query(
          'SELECT id, nombre, precio, stock FROM productos WHERE id = ANY($1::int[]) AND activo ORDER BY id FOR UPDATE',
          [[...cantidades.keys()]]
        );
        if (encontrados.rows.length !== cantidades.size) throw errorDeUsuario('Alguno de los productos ya no está disponible');
        for (const p of encontrados.rows) {
          if (p.stock < cantidades.get(p.id)) {
            throw errorDeUsuario(
              p.stock === 0 ? `"${p.nombre}" está agotado` : `Solo quedan ${p.stock} pieza(s) de "${p.nombre}"`
            );
          }
        }

        // El total se calcula aquí con los precios de la base de datos, nunca con lo que mande el cliente.
        const centavos = encontrados.rows.reduce((suma, p) => suma + Math.round(parseFloat(p.precio) * 100) * cantidades.get(p.id), 0);
        const insertado = await client.query(
          'INSERT INTO pedidos (total, status, usuario_id, metodo_pago) VALUES ($1, $2, $3, $4) RETURNING *',
          [centavos / 100, 'pendiente', usuario.id, metodo]
        );
        pedido = insertado.rows[0];
        for (const [productoId, cantidad] of cantidades) {
          await client.query('INSERT INTO pedido_productos (pedido_id, producto_id, cantidad) VALUES ($1, $2, $3)', [pedido.id, productoId, cantidad]);
          await client.query('UPDATE productos SET stock = stock - $1 WHERE id = $2', [cantidad, productoId]);
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        if (error instanceof GraphQLError) throw error;
        console.error('Error al crear pedido:', error);
        throw new Error('Error al crear pedido');
      } finally {
        client.release();
      }

      // 2) Cobrar. Si algo falla, se cancela el pedido y las piezas regresan al inventario.
      let cobro;
      try {
        cobro = await crearCobro({ pedido, usuario, metodo, tarjeta });
      } catch (error) {
        console.error('Error al crear el cobro:', error);
        await cancelarPedido(pedido.id, 'cancelado');
        throw new Error('No pudimos procesar tu pago. Inténtalo de nuevo en un momento.');
      }
      if (cobro.estado === 'rechazado') {
        await cancelarPedido(pedido.id, 'cancelado');
        throw errorDeUsuario('Tu pago fue rechazado. Revisa los datos o prueba con otro método de pago.');
      }

      // 3) Guardar el resultado del cobro (referencia de OXXO/SPEI, fecha límite, id del pago, etc.).
      const pagado = cobro.estado === 'pagado';
      const actualizado = await pool.query(
        `UPDATE pedidos
            SET status = $2::varchar, pago_id = $3, pago_referencia = $4, pago_url = $5, pago_expira = $6,
                pagado_en = CASE WHEN $2::varchar = 'pagado' THEN NOW() ELSE NULL END
          WHERE id = $1 RETURNING *`,
        [pedido.id, pagado ? 'pagado' : 'pendiente', cobro.pagoId, cobro.referencia, cobro.url, cobro.expira]
      );
      return actualizado.rows[0];
    },

    /** Solo en modo simulado: marca como pagado un pedido pendiente (para probar OXXO/SPEI sin Mercado Pago). */
    simularPago: async (_, { pedidoId }, ctx) => {
      const usuario = requiereLogin(ctx);
      if (MODO !== 'simulado') throw errorProhibido();
      const id = idEntero(pedidoId);
      const res = await pool.query('SELECT * FROM pedidos WHERE id = $1 AND (usuario_id = $2 OR $3::boolean)', [id, usuario.id, usuario.rol === 'admin']);
      const pedido = res.rows[0];
      if (!pedido) throw errorDeUsuario('No encontramos ese pedido');
      await aplicarEstadoPago(id, 'pagado', pedido.pago_id);
      return (await pool.query('SELECT * FROM pedidos WHERE id = $1', [id])).rows[0];
    },

    crearProducto: async (_, args, ctx) => {
      requiereAdmin(ctx);
      const { nombre, precio, imagen, stock } = validarProducto(args);
      const respuesta = await pool.query(
        'INSERT INTO productos (nombre, precio, imagen, stock) VALUES ($1, $2, $3, $4) RETURNING *',
        [nombre, precio, imagen, stock]
      );
      return respuesta.rows[0];
    },

    actualizarProducto: async (_, { id, ...datos }, ctx) => {
      requiereAdmin(ctx);
      const n = idEntero(id);
      const { nombre, precio, imagen, stock } = validarProducto(datos);
      const res = await pool.query(
        'UPDATE productos SET nombre = $2, precio = $3, imagen = $4, stock = $5 WHERE id = $1 AND activo RETURNING *',
        [n, nombre, precio, imagen, stock]
      );
      if (res.rowCount === 0) throw errorDeUsuario('Ese producto ya no existe');
      return res.rows[0];
    },

    ajustarStock: async (_, { id, cantidad }, ctx) => {
      requiereAdmin(ctx);
      const n = idEntero(id);
      if (!Number.isInteger(cantidad) || cantidad === 0 || Math.abs(cantidad) > 100_000) {
        throw errorDeUsuario('La cantidad debe ser un entero distinto de cero');
      }
      try {
        const res = await pool.query('UPDATE productos SET stock = stock + $2 WHERE id = $1 AND activo RETURNING *', [n, cantidad]);
        if (res.rowCount === 0) throw errorDeUsuario('Ese producto ya no existe');
        return res.rows[0];
      } catch (error) {
        if (error.code === '23514') throw errorDeUsuario('El stock no puede quedar en negativo');
        throw error;
      }
    },

    eliminarProducto: async (_, { id }, ctx) => {
      requiereAdmin(ctx);
      const n = idEntero(id);
      // Si el producto ya aparece en pedidos se archiva (así el historial no se rompe); si no, se borra.
      const usado = await pool.query('SELECT 1 FROM pedido_productos WHERE producto_id = $1 LIMIT 1', [n]);
      if (usado.rowCount > 0) {
        await pool.query('UPDATE productos SET activo = FALSE WHERE id = $1', [n]);
        return `Producto ${n} archivado (ya tenía pedidos; deja de aparecer en el catálogo)`;
      }
      await pool.query('DELETE FROM productos WHERE id = $1', [n]);
      return `Producto ${n} eliminado`;
    },

    actualizarUsuario: async (_, { id, nombre, email }, ctx) => {
      requiereAdmin(ctx);
      const n = idEntero(id);
      nombre = nombre.trim();
      email = email.trim().toLowerCase();
      if (nombre.length < 2 || nombre.length > 100) throw errorDeUsuario('El nombre debe tener entre 2 y 100 caracteres');
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw errorDeUsuario('El correo no es válido');
      try {
        const res = await pool.query(
          "UPDATE usuarios SET nombre = $2, email = $3 WHERE id = $1 AND rol = 'cliente' RETURNING id, nombre, email, rol, activo, creado",
          [n, nombre, email]
        );
        if (res.rowCount === 0) throw errorDeUsuario('No encontramos a ese cliente');
        return { ...res.rows[0], pedidos: 0, total_comprado: 0 };
      } catch (error) {
        if (error.code === '23505') throw errorDeUsuario('Ese correo ya está registrado');
        throw error;
      }
    },

    cambiarEstadoUsuario: async (_, { id, activo }, ctx) => {
      requiereAdmin(ctx);
      const n = idEntero(id);
      const res = await pool.query(
        "UPDATE usuarios SET activo = $2 WHERE id = $1 AND rol = 'cliente' RETURNING id, nombre, email, rol, activo, creado",
        [n, activo]
      );
      if (res.rowCount === 0) throw errorDeUsuario('No encontramos a ese cliente');
      return { ...res.rows[0], pedidos: 0, total_comprado: 0 };
    },

    eliminarUsuario: async (_, { id }, ctx) => {
      requiereAdmin(ctx);
      const n = idEntero(id);
      const pendientes = await pool.query("SELECT 1 FROM pedidos WHERE usuario_id = $1 AND status = 'pendiente' LIMIT 1", [n]);
      if (pendientes.rowCount > 0) throw errorDeUsuario('No se puede eliminar: el cliente tiene pedidos pendientes de pago');
      // Sus pedidos se conservan en el historial (usuario_id queda en NULL).
      const res = await pool.query("DELETE FROM usuarios WHERE id = $1 AND rol = 'cliente'", [n]);
      if (res.rowCount === 0) throw errorDeUsuario('No encontramos a ese cliente');
      return `Cliente ${n} eliminado`;
    },
  },
};

const server = new ApolloServer({
  typeDefs: TypeDefs,
  resolvers,
  // No exponer rutas internas ni stack traces a los clientes.
  includeStacktraceInErrorResponses: false,
});
await server.start();

const app = express();
app.disable('x-powered-by');

/**
 * Webhook de Mercado Pago. Mercado Pago llama aquí cuando cambia el estado de un pago (por ejemplo,
 * cuando alguien paga en OXXO). Nunca confiamos en el cuerpo del aviso: solo tomamos el id del pago
 * y le preguntamos a Mercado Pago cuál es su estado real.
 * En desarrollo expón el puerto con ngrok/cloudflared y pon esa URL en BACKEND_PUBLIC_URL.
 */
app.post('/webhooks/mercadopago', express.json({ limit: '100kb' }), async (req, res) => {
  try {
    if (MODO === 'simulado') return res.sendStatus(200);
    if (!verificarFirmaWebhook(req)) return res.sendStatus(401);

    const tipo = req.body?.type ?? req.query.type ?? req.query.topic;
    const pagoId = String(req.body?.data?.id ?? req.query['data.id'] ?? '');
    if (tipo !== 'payment' || !/^[\w-]{1,64}$/.test(pagoId)) return res.sendStatus(200);

    const pago = await consultarPago(pagoId);
    let pedidoId = pago.pedidoId;
    if (!pedidoId) {
      const fila = await pool.query('SELECT id FROM pedidos WHERE pago_id = $1', [pago.pagoId]);
      pedidoId = fila.rows[0]?.id ?? null;
    }
    if (!pedidoId) {
      console.warn(`Webhook: el pago ${pagoId} no corresponde a ningún pedido`);
      return res.sendStatus(200);
    }
    await aplicarEstadoPago(pedidoId, pago.estado, pago.pagoId);
    return res.sendStatus(200);
  } catch (error) {
    console.error('Error en el webhook de Mercado Pago:', error);
    return res.sendStatus(500); // Mercado Pago reintenta cuando recibe un 5xx
  }
});

app.use(
  express.json({ limit: '200kb' }),
  expressMiddleware(server, {
    // Se ejecuta en cada petición: lee el JWT y carga el usuario desde la base de datos.
    // Una cuenta suspendida deja de funcionar aunque su token siga vigente.
    context: async ({ req }) => {
      const id = idDesdeRequest(req);
      if (!id) return { usuario: null };
      const res = await pool.query(`SELECT ${USUARIO_PUBLICO} FROM usuarios WHERE id = $1 AND activo`, [id]);
      return { usuario: res.rows[0] ?? null };
    },
  })
);

const port = Number(process.env.PORT) || 4000;
const httpServer = http.createServer(app);
await new Promise((resolve) => httpServer.listen({ port }, resolve));
console.log(`Servidor listo en http://0.0.0.0:${port}/`);
console.log(
  MODO === 'simulado'
    ? '🧪 Pagos en modo SIMULADO (no se llama a Mercado Pago). Cambia MP_MODO=real cuando termines la integración.'
    : '💳 Pagos en modo REAL con Mercado Pago.'
);

// Libera el stock de pedidos de OXXO/SPEI vencidos: al arrancar y cada 10 minutos.
const revisarExpirados = () => expirarPedidosVencidos().catch((e) => console.error('Error al expirar pedidos:', e.message));
await revisarExpirados();
setInterval(revisarExpirados, 10 * 60 * 1000).unref();

import 'dotenv/config';
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
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
  `);
} catch (err) {
  console.error('❌ No se pudo preparar el esquema de usuarios:', err.message);
  console.error('   ¿Ya cargaste db.sql? (crea las tablas productos, pedidos y pedido_productos)');
}

const TypeDefs = `#graphql
type Producto {
  id: ID!
  nombre: String!
  precio: Float!
  imagen: String!
}

type Usuario {
  id: ID!
  nombre: String!
  email: String!
  rol: String!
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
}

type Query {
  productos: [Producto]
  producto(id: ID!): Producto
  me: Usuario
  misPedidos: [Pedido!]!
}

type Mutation {
  registrar(nombre: String!, email: String!, password: String!): AuthPayload!
  login(email: String!, password: String!): AuthPayload!
  crearPedido(productos: [ID!]!): Pedido
  crearProducto(nombre: String!, precio: Float!, imagen: String!): Producto
  eliminarProducto(id: ID!): String
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

const resolvers = {
  Query: {
    productos: async () => {
      try {
        const res = await pool.query('SELECT * FROM productos ORDER BY id');
        return res.rows;
      } catch (error) {
        console.error('Error al obtener productos:', error);
        throw new Error('Error al obtener productos');
      }
    },
    producto: async (_, { id }) => {
      const n = Number(id);
      if (!Number.isInteger(n)) return null;
      const res = await pool.query('SELECT * FROM productos WHERE id = $1', [n]);
      return res.rows[0] ?? null;
    },
    me: (_, __, ctx) => ctx.usuario,
    misPedidos: async (_, __, ctx) => {
      const usuario = requiereLogin(ctx);
      const res = await pool.query('SELECT * FROM pedidos WHERE usuario_id = $1 ORDER BY fecha DESC, id DESC', [usuario.id]);
      return res.rows;
    },
  },

  Pedido: {
    fecha: (pedido) => new Date(pedido.fecha).toISOString(),
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
      const { password_hash, ...usuario } = fila;
      return { token: firmarToken(usuario), usuario };
    },

    crearPedido: async (_, { productos }, ctx) => {
      const usuario = requiereLogin(ctx);
      if (productos.length === 0 || productos.length > 500) throw errorDeUsuario('El carrito no es válido');

      // Los ids repetidos cuentan como cantidad: ["1","1","3"] => 2 x producto 1, 1 x producto 3.
      const cantidades = new Map();
      for (const raw of productos) {
        const id = Number(raw);
        if (!Number.isInteger(id)) throw errorDeUsuario('El carrito contiene un producto inválido');
        cantidades.set(id, (cantidades.get(id) ?? 0) + 1);
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const encontrados = await client.query('SELECT id, precio FROM productos WHERE id = ANY($1::int[])', [[...cantidades.keys()]]);
        if (encontrados.rows.length !== cantidades.size) throw errorDeUsuario('Alguno de los productos ya no está disponible');

        // El total se calcula aquí con los precios de la base de datos, nunca con lo que mande el cliente.
        const centavos = encontrados.rows.reduce((suma, p) => suma + Math.round(parseFloat(p.precio) * 100) * cantidades.get(p.id), 0);
        const insertado = await client.query(
          'INSERT INTO pedidos (total, status, usuario_id) VALUES ($1, $2, $3) RETURNING *',
          [centavos / 100, 'pendiente', usuario.id]
        );
        const pedido = insertado.rows[0];
        for (const [productoId, cantidad] of cantidades) {
          await client.query(
            'INSERT INTO pedido_productos (pedido_id, producto_id, cantidad) VALUES ($1, $2, $3)',
            [pedido.id, productoId, cantidad]
          );
        }
        await client.query('COMMIT');
        return pedido;
      } catch (error) {
        await client.query('ROLLBACK');
        if (error instanceof GraphQLError) throw error;
        console.error('Error al crear pedido:', error);
        throw new Error('Error al crear pedido');
      } finally {
        client.release();
      }
    },

    crearProducto: async (_, { nombre, precio, imagen }, ctx) => {
      requiereAdmin(ctx);
      const respuesta = await pool.query('INSERT INTO productos (nombre, precio, imagen) VALUES ($1, $2, $3) RETURNING *', [nombre, precio, imagen]);
      return respuesta.rows[0];
    },

    eliminarProducto: async (_, { id }, ctx) => {
      requiereAdmin(ctx);
      await pool.query('DELETE FROM productos WHERE id = $1', [parseInt(id)]);
      return `Producto con ID ${id} eliminado`;
    },
  },
};

const server = new ApolloServer({
  typeDefs: TypeDefs,
  resolvers,
  // No exponer rutas internas ni stack traces a los clientes.
  includeStacktraceInErrorResponses: false,
});

const { url } = await startStandaloneServer(server, {
  listen: { port: Number(process.env.PORT) || 4000 },
  // Se ejecuta en cada petición: lee el JWT y carga el usuario desde la base de datos.
  context: async ({ req }) => {
    const id = idDesdeRequest(req);
    if (!id) return { usuario: null };
    const res = await pool.query(`SELECT ${USUARIO_PUBLICO} FROM usuarios WHERE id = $1`, [id]);
    return { usuario: res.rows[0] ?? null };
  },
});
console.log(`Servidor listo en ${url}`);

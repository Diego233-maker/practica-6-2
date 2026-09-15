import {ApolloServer} from '@apollo/server';
import {startStandaloneServer} from '@apollo/server/standalone';
import pkg from 'pg';
const {Pool} = pkg;
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'bakinghub',
  password: '270805',
  port: 5432,
});

const TypeDefs = `#graphql
type Producto {
  id: ID!
  nombre: String!
  precio: Float!
  imagen: String!
}

type Pedido {
  id: ID!
  total: Float!
  status: String!
}

type Query {
  productos: [Producto]
}

type Mutation {
  crearPedido(productos: [ID!]!): Pedido
  crearProducto(nombre: String!, precio: Float!, imagen: String!): Producto
  eliminarProducto(id: ID!): String
}
`;


const resolvers = {
  Query: {
    productos: async () => {
      try{
      const res = await pool.query('SELECT * FROM productos');
      return res.rows;
    }catch (error) {
      console.error('Error al obtener productos:', error);
      throw new Error('Error al obtener productos');
    }
  },
  },
  Mutation: {
  crearPedido: async (_, {productos}) => {
    try{
      const ids = productos.map(id => parseInt(id));
      const productosQuery = await pool.query('SELECT * FROM productos WHERE id = ANY($1::int[])', [ids]);
      const total= productosQuery.rows.reduce((suma, prod) => suma + parseFloat(prod.precio), 0);
      const insertarPedido = await pool.query('INSERT INTO pedidos (total, status) VALUES ($1, $2) RETURNING *', [total, 'pendiente']);
      const nuevoPedido = insertarPedido.rows[0];
      for(const prodId of ids){
        await pool.query('INSERT INTO pedido_productos (pedido_id, producto_id) VALUES ($1, $2)', [nuevoPedido.id, prodId]);
    }
    return nuevoPedido;
  }  catch (error) {
    console.error('Error al crear pedido:', error);
    throw new Error('Error al crear pedido');
  }
},
crearProducto: async (_, {nombre, precio, imagen}) => {
  const respuesta = await pool.query('INSERT INTO productos (nombre, precio, imagen) VALUES ($1, $2, $3) RETURNING *', [nombre, precio, imagen]);
  return respuesta.rows[0];
},
eliminarProducto: async (_, {id}) => {
  await pool.query('DELETE FROM productos WHERE id = $1', [parseInt(id)]);
  return `Producto con ID ${id} eliminado`;
}
  }
};
const sever = new ApolloServer({
  typeDefs: TypeDefs,
  resolvers: resolvers
});
const {url} = await startStandaloneServer(sever, {
  listen: {port: 4000}
});
console.log(`Servidor listo en ${url}`);
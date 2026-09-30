export const OBTENER_MENU = `
  query ObtenerMenu {
    productos { id nombre precio imagen }
  }
`;

export const OBTENER_PRODUCTO = `
  query ObtenerProducto($id: ID!) {
    producto(id: $id) { id nombre precio imagen }
  }
`;

export const CREAR_PEDIDO = `
  mutation CrearPedido($productos: [ID!]!) {
    crearPedido(productos: $productos) { id total status }
  }
`;

export const MIS_PEDIDOS = `
  query MisPedidos {
    misPedidos {
      id total status fecha
      productos { id nombre precio cantidad }
    }
  }
`;

export const ME = `
  query Me {
    me { id nombre email rol }
  }
`;

export const LOGIN = `
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) { token }
  }
`;

export const REGISTRAR = `
  mutation Registrar($nombre: String!, $email: String!, $password: String!) {
    registrar(nombre: $nombre, email: $email, password: $password) { token }
  }
`;

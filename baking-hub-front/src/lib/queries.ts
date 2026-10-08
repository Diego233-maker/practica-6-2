export const OBTENER_MENU = `
  query ObtenerMenu {
    productos { id nombre precio imagen stock }
  }
`;

export const OBTENER_PRODUCTO = `
  query ObtenerProducto($id: ID!) {
    producto(id: $id) { id nombre precio imagen stock }
  }
`;

const CAMPOS_PEDIDO = `
  id total status fecha
  metodoPago pagoReferencia pagoUrl pagoExpira
  productos { id nombre precio cantidad }
`;

export const CREAR_PEDIDO = `
  mutation CrearPedido($productos: [ID!]!, $metodoPago: String!, $tarjeta: TarjetaInput) {
    crearPedido(productos: $productos, metodoPago: $metodoPago, tarjeta: $tarjeta) {
      id total status metodoPago pagoUrl
    }
  }
`;

export const MIS_PEDIDOS = `
  query MisPedidos {
    misPedidos { ${CAMPOS_PEDIDO} }
  }
`;

export const OBTENER_PEDIDO = `
  query ObtenerPedido($id: ID!) {
    pedido(id: $id) { ${CAMPOS_PEDIDO} }
  }
`;

export const CONFIG_PAGOS = `
  query ConfigPagos {
    configPagos { modo metodos horasParaPagar }
  }
`;

/** Solo funciona con MP_MODO=simulado en el backend. */
export const SIMULAR_PAGO = `
  mutation SimularPago($pedidoId: ID!) {
    simularPago(pedidoId: $pedidoId) { id status }
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

/* ---------------------------------- Panel de administración ---------------------------------- */

export const ADMIN_RESUMEN = `
  query AdminResumen {
    adminResumen {
      productos sinStock stockBajo clientes clientesSuspendidos
      pedidosPendientes pedidosPagados ventas
    }
  }
`;

export const ADMIN_PRODUCTOS = `
  query AdminProductos {
    adminProductos { id nombre precio imagen stock }
  }
`;

export const ADMIN_USUARIOS = `
  query AdminUsuarios($busqueda: String) {
    adminUsuarios(busqueda: $busqueda) {
      id nombre email rol activo creado pedidos totalComprado
    }
  }
`;

export const CREAR_PRODUCTO = `
  mutation CrearProducto($nombre: String!, $precio: Float!, $imagen: String!, $stock: Int) {
    crearProducto(nombre: $nombre, precio: $precio, imagen: $imagen, stock: $stock) { id }
  }
`;

export const ACTUALIZAR_PRODUCTO = `
  mutation ActualizarProducto($id: ID!, $nombre: String!, $precio: Float!, $imagen: String!, $stock: Int!) {
    actualizarProducto(id: $id, nombre: $nombre, precio: $precio, imagen: $imagen, stock: $stock) { id }
  }
`;

export const AJUSTAR_STOCK = `
  mutation AjustarStock($id: ID!, $cantidad: Int!) {
    ajustarStock(id: $id, cantidad: $cantidad) { id stock }
  }
`;

export const ELIMINAR_PRODUCTO = `
  mutation EliminarProducto($id: ID!) {
    eliminarProducto(id: $id)
  }
`;

export const ACTUALIZAR_USUARIO = `
  mutation ActualizarUsuario($id: ID!, $nombre: String!, $email: String!) {
    actualizarUsuario(id: $id, nombre: $nombre, email: $email) { id }
  }
`;

export const CAMBIAR_ESTADO_USUARIO = `
  mutation CambiarEstadoUsuario($id: ID!, $activo: Boolean!) {
    cambiarEstadoUsuario(id: $id, activo: $activo) { id activo }
  }
`;

export const ELIMINAR_USUARIO = `
  mutation EliminarUsuario($id: ID!) {
    eliminarUsuario(id: $id)
  }
`;

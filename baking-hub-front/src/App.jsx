import { useState } from 'react';
import ProductCard from './components/ProductCard';
import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import './App.css';

const OBTENER_MENU = gql`
  query ObtenerMenu {
    productos {
      id
      nombre
      precio
      imagen
    }
  }
`;
const CREAR_PEDIDO = gql`
  mutation CrearPedido($productos: [ID!]!) {
    crearPedido(productos: $productos) {
      id
      total
      status
    }
  }
`;

const SkeletonCard = () => (
  <div className="skeleton-card">
    <div className="skeleton-img"></div>
    <div className="skeleton-line"></div>
    <div className="skeleton-line corta"></div>
  </div>
);

function App() {
  const [pantallaActual, setPantallaActual] = useState('inicio');
  const [carrito, setCarrito] = useState([]);
  const { loading, error, data } = useQuery(OBTENER_MENU);
  const [ejecutarPago, { loading: pagando }] = useMutation(CREAR_PEDIDO);
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [categoriaActiva, setCategoriaActiva] = useState('Todas');

  const obtenerCategoria = (nombre) => {
    const texto = nombre.toLowerCase();

    if (texto.includes('chocolate')) return 'Chocolates';
    if (
      texto.includes('pan') ||
      texto.includes('rol') ||
      texto.includes('galleta') ||
      texto.includes('pastel')
    )
      return 'Panadería';

    return 'Otra';
  };

  const manejarPago = async () => {
    try {
      const idsDelCarrito = carrito.map((postre) => postre.id);

      const respuesta = await ejecutarPago({ variables: { productos: idsDelCarrito } });
      const pedidoCreado = respuesta.data.crearPedido;
      alert(`Pedido creado con éxito! ID: ${pedidoCreado.id}, Total: ${pedidoCreado.total}`);
      setCarrito([]);
      setPantallaActual('inicio');
    } catch (error) {
      console.error('Error al crear el pedido:', error);
      alert('Hubo un error al procesar el pago. Por favor, inténtalo de nuevo.');
    }
  };

  const productosFiltrados =
    data?.productos.filter((postre) => {
      if (categoriaActiva === 'Todas') return true;
      return obtenerCategoria(postre.nombre) === categoriaActiva;
    }) || [];

  const irACategoria = (categoria) => {
    setCategoriaActiva(categoria);
    setPantallaActual('inicio');
  };

  return (
    <div className="layout-principal">
      <header className="top-bar">
        <h1 className="brand" onClick={() => setPantallaActual('inicio')}>
          Baking Hub
        </h1>
        <button className="cart-button" onClick={() => setPantallaActual('carrito')}>
          Carrito ({carrito.length})
        </button>
      </header>

      <div className="contenedor-central">
        <aside className="side-bar">
          <h3>Categorías</h3>
          <ul className="category-list">
            <li
              className={`category-item ${categoriaActiva === 'Todas' ? 'activa' : ''}`}
              onClick={() => irACategoria('Todas')}
            >
              Ver todo
            </li>
            <li
              className={`category-item ${categoriaActiva === 'Chocolates' ? 'activa' : ''}`}
              onClick={() => irACategoria('Chocolates')}
            >
              Chocolates
            </li>
            <li
              className={`category-item ${categoriaActiva === 'Panadería' ? 'activa' : ''}`}
              onClick={() => irACategoria('Panadería')}
            >
              Panadería
            </li>
          </ul>
        </aside>

        <main className="main-content">
          {pantallaActual === 'inicio' && (
            <div>
              {categoriaActiva === 'Todas' && (
                <div className="hero">
                  <h2>Bienvenido a Baking Hub</h2>
                  <p>Los mejores postres horneados, directo del horno a tu mesa.</p>
                </div>
              )}

              <h2 className="section-title">Catálogo: {categoriaActiva}</h2>

              {loading && (
                <div className="product-grid">
                  <SkeletonCard />
                  <SkeletonCard />
                  <SkeletonCard />
                </div>
              )}

              {error && <p className="mensaje-error">Error de conexión: {error.message}</p>}

              {data && (
                <div className="product-grid">
                  {productosFiltrados.length === 0 ? (
                    <p className="estado-vacio">No hay productos en esta categoría.</p>
                  ) : null}
                  {productosFiltrados.map((postre) => (
                    <ProductCard
                      key={postre.id}
                      nombre={postre.nombre}
                      precio={postre.precio}
                      imagen={postre.imagen}
                      alHacerClic={() => {
                        setProductoSeleccionado(postre);
                        setPantallaActual('detalle');
                      }}
                    />
                  ))}
                </div>
              )}

              {categoriaActiva === 'Todas' && !loading && (
                <div className="context">
                  <h3>¿Por qué elegirnos?</h3>
                  <p>
                    En Baking Hub garantizamos ingredientes 100% orgánicos y entregas el mismo día
                    para que disfrutes de la frescura en cada bocado.
                  </p>
                </div>
              )}
            </div>
          )}

          {pantallaActual === 'detalle' && productoSeleccionado && (
            <div className="detalle-card">
              <button className="volver-btn" onClick={() => setPantallaActual('inicio')}>
                ← Volver al catálogo
              </button>
              <h2>{productoSeleccionado.nombre}</h2>
              <img src={productoSeleccionado.imagen} alt={productoSeleccionado.nombre} />
              <p className="detalle-precio">Precio: ${productoSeleccionado.precio} MXN</p>
              <button
                className="btn-primario"
                onClick={() => {
                  setCarrito([...carrito, productoSeleccionado]);
                  setPantallaActual('carrito');
                }}
              >
                Añadir al carrito
              </button>
            </div>
          )}

          {pantallaActual === 'carrito' && (
            <div>
              <h2 className="section-title">Tu carrito de compras</h2>
              {carrito.length === 0 ? (
                <p className="estado-vacio">Aún no has agregado nada delicioso.</p>
              ) : (
                <ul className="carrito-lista">
                  {carrito.map((item, index) => (
                    <li className="carrito-item" key={index}>
                      <strong>{item.nombre}</strong>
                      <span>${item.precio}</span>
                    </li>
                  ))}
                </ul>
              )}
              <button
                className="checkout-btn"
                onClick={() => setPantallaActual('checkout')}
                disabled={carrito.length === 0}
              >
                Ir al checkout
              </button>
            </div>
          )}

          {pantallaActual === 'checkout' && (
            <div className="checkout-card">
              <h2 className="section-title">Resumen de orden</h2>
              <p>Total de artículos: {carrito.length}</p>
              <button
                className={`pagar-btn ${pagando ? 'procesando' : 'activo'}`}
                onClick={manejarPago}
                disabled={pagando}
              >
                {pagando ? 'Procesando con el banco...' : 'Confirmar y pagar'}
              </button>
              <button className="cancelar-btn" onClick={() => setPantallaActual('carrito')}>
                Cancelar y regresar
              </button>
            </div>
          )}
        </main>
      </div>

      <footer className="app-footer">
        <p>Baking Hub © 2026. Proyecto Universitario - Práctica 6-2.</p>
      </footer>
    </div>
  );
}

export default App;

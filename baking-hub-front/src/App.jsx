import { useState } from 'react';
import ProductCard from './components/ProductCard';
import {gql} from '@apollo/client';
import {useMutation, useQuery} from '@apollo/client/react';
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
  <div style={{ width: '200px', height: '250px', backgroundColor: '#e0e0e0', borderRadius: '10px', animation: 'pulse 1.5s infinite' }}>
    <div style={{ height: '150px', backgroundColor: '#ccc', borderRadius: '10px 10px 0 0' }}></div>
    <div style={{ padding: '10px' }}>
      <div style={{ height: '20px', backgroundColor: '#ccc', marginBottom: '10px', borderRadius: '5px' }}></div>
      <div style={{ height: '20px', width: '50%', backgroundColor: '#ccc', borderRadius: '5px' }}></div>
    </div>
  </div>
);
function App() {
  
  const [pantallaActual, setPantallaActual] = useState('inicio'); 
  const [carrito, setCarrito] = useState([]);
  const {loading, error, data} = useQuery(OBTENER_MENU);
  const [ejecutarPago, {loading: pagando}]= useMutation(CREAR_PEDIDO);
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [categoriaActiva, setCategoriaActiva] = useState('Todas');

  const obtenerCategoria = (nombre) => {
    const texto = nombre.toLowerCase();

    if (texto.includes('chocolate')) return 'Chocolates';
    if (texto.includes('pan') || texto.includes('rol') || texto.includes('galleta') || texto.includes('pastel')) return 'Panadería';

    return 'Otra';
  };

  const manejarPago = async () => {
    try {
      const idsDelCarrito = carrito.map(postre => postre.id);
    
    const respuesta = await ejecutarPago({variables: {productos: idsDelCarrito}});
    const pedidoCreado = respuesta.data.crearPedido;
    alert(`Pedido creado con éxito! ID: ${pedidoCreado.id}, Total: ${pedidoCreado.total}`);
    setCarrito([]);
    setPantallaActual('inicio');
    }catch (error) {
      console.error('Error al crear el pedido:', error);
      alert('Hubo un error al procesar el pago. Por favor, inténtalo de nuevo.');
    }
  };
  const productosFiltrados = data?.productos.filter((postre) => {
    if (categoriaActiva === 'Todas') return true;

    return obtenerCategoria(postre.nombre) === categoriaActiva;
  }) || [];

  return (
   <>
      <div className="layout-principal">
        <header className="top-bar">
          <h1 onClick={() => setPantallaActual('inicio')} style={{cursor: 'pointer', margin: 0}}>Baking Hub </h1>
          <button onClick={() => setPantallaActual('carrito')} style={{backgroundColor: '#ff8c00', color: 'white', border: 'none', padding: '10px', borderRadius: '5px', cursor: 'pointer'}}>
             Carrito ({carrito.length})
          </button>
        </header>

        <div className="contenedor-central" style={{ display: 'flex', minHeight: '80vh' }}>
          
          <aside className="side-bar" style={{ width: '200px', padding: '20px', borderRight: '1px solid #ccc' }}>
            <h3>Categorías</h3>
            <ul style={{ listStyle: 'none', padding: 0, lineHeight: '2' }}>
              <li onClick={() => { setCategoriaActiva('Todas'); setPantallaActual('inicio'); }} style={{cursor: 'pointer', fontWeight: categoriaActiva === 'Todas' ? 'bold' : 'normal'}}>Ver Todo</li>
              <li onClick={() => { setCategoriaActiva('Chocolates'); setPantallaActual('inicio'); }} style={{cursor: 'pointer', fontWeight: categoriaActiva === 'Chocolates' ? 'bold' : 'normal'}}> Chocolates</li>
              <li onClick={() => { setCategoriaActiva('Panadería'); setPantallaActual('inicio'); }} style={{cursor: 'pointer', fontWeight: categoriaActiva === 'Panadería' ? 'bold' : 'normal'}}>Panadería</li>
            </ul>
          </aside>

          <main className="main-content" style={{ flex: 1, padding: '20px' }}>
            
            {pantallaActual === 'inicio' && (
              <div>
                {/* REQUISITO: HERO SECTION */}
                {categoriaActiva === 'Todas' && (
                  <div className="hero" style={{ backgroundColor: '#ffe4b5', padding: '40px', borderRadius: '10px', textAlign: 'center', marginBottom: '20px' }}>
                    <h2 style={{fontSize: '2.5rem', margin: 0}}>¡Bienvenido a Baking Hub!</h2>
                    <p style={{fontSize: '1.2rem'}}>Los mejores postres horneados con GraphQL.</p>
                  </div>
                )}

                <h2>Catálogo: {categoriaActiva}</h2>
                
                {/* TEMA REACT #8: SKELETONS EN ACCIÓN */}
                {loading && (
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                  </div>
                )}
                
                {error && <p style={{color:'red'}}>Error de conexión: {error.message}</p>}
                
                {data && (
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    {productosFiltrados.length === 0 ? <p>No hay productos en esta categoría.</p> : null}
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

                {/* REQUISITO: CONTEXT SECTION */}
                {categoriaActiva === 'Todas' && !loading && (
                  <div className="context" style={{ marginTop: '40px', padding: '20px', borderTop: '2px solid #eee' }}>
                    <h3>¿Por qué elegirnos?</h3>
                    <p>En Baking Hub garantizamos ingredientes 100% orgánicos y entregas el mismo día para que disfrutes de la frescura en cada bocado.</p>
                  </div>
                )}
              </div>
            )}

            {/* PANTALLA 2: Detalle */}
            {pantallaActual === 'detalle' && productoSeleccionado && (
              <div style={{ padding: '20px', border: '2px dashed #ccc', borderRadius: '10px', maxWidth: '500px' }}>
                <button onClick={() => setPantallaActual('inicio')}>Volver al catálogo</button>
                <h2 style={{ fontSize: '2rem', color: '#d2691e' }}>{productoSeleccionado.nombre}</h2>
                <div style={{ fontSize: '80px', margin: '20px 0' }}><img src={productoSeleccionado.imagen} alt={productoSeleccionado.nombre} style={{ maxWidth: '100%', height: 'auto' }} /></div>
                <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Precio: ${productoSeleccionado.precio} MXN</p>
                <button 
                  style={{ backgroundColor: '#ff8c00', color: 'white', padding: '15px', cursor: 'pointer', width: '100%' }}
                  onClick={() => {
                    setCarrito([...carrito, productoSeleccionado]);
                    setPantallaActual('carrito');
                  }}
                >
                  Añadir al Carrito 
                </button>
              </div>
            )}

            {/* PANTALLA 3: Carrito */}
            {pantallaActual === 'carrito' && (
              <div>
                <h2>Tu Carrito de Compras</h2>
                {carrito.length === 0 ? (
                  <p>Aún no has agregado nada delicioso. </p>
                ) : (
                  <ul style={{fontSize: '1.2rem', lineHeight: '2'}}>
                    {carrito.map((item, index) => (
                      <li key={index}><strong>{item.nombre}</strong> - ${item.precio}</li>
                    ))}
                  </ul>
                )}
                <button 
                  style={{ backgroundColor: 'green', color: 'white', padding: '10px 20px', marginTop: '20px' }}
                  onClick={() => setPantallaActual('checkout')} 
                  disabled={carrito.length === 0}
                >
                  Ir al Checkout 
                </button>
              </div>
            )}

            {/* PANTALLA 4: Checkout */}
            {pantallaActual === 'checkout' && (
              <div style={{ padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '10px', maxWidth: '400px' }}>
                <h2>Resumen de Orden</h2>
                <p>Total de artículos: {carrito.length}</p>
                <button 
                  style={{ backgroundColor: pagando ? 'gray' : '#ff4500', color: 'white', padding: '15px', width: '100%', cursor: pagando ? 'not-allowed' : 'pointer' }} 
                  onClick={manejarPago} 
                  disabled={pagando}
                >
                  {pagando ? 'Procesando con el banco...' : 'Confirmar y Pagar'}
                </button>
                <button onClick={() => setPantallaActual('carrito')} style={{ marginTop: '10px', width: '100%', padding: '10px' }}>
                  Cancelar y regresar
                </button>
              </div>
            )}

          </main>
        </div>

        {/* REQUISITO: FOOTER */}
        <footer style={{ backgroundColor: '#333', color: 'white', textAlign: 'center', padding: '20px', marginTop: 'auto' }}>
          <p>Baking Hub © 2026. Proyecto Universitario - Práctica 6-2.</p>
        </footer>
      </div>
    </>
  );
}

export default App;
import React from 'react';

function ProductCard({ nombre, precio, imagen, alHacerClic }) {
  return (
    <div className="tarjeta-producto">
      <img src={imagen} alt={nombre} />
      <div className="tarjeta-producto-info">
        <h3>{nombre}</h3>
        <p className="precio">${precio} MXN</p>
        <button className="ver-detalle-btn" onClick={alHacerClic}>
          Ver detalles
        </button>
      </div>
    </div>
  );
}

export default ProductCard;

import React from 'react';

function ProductCard({nombre, precio, imagen, alHacerClic}) {
return(
    <div className= "tarjeta-producto" style ={{border : '1px solid #ccc', padding : '1rem',margin : '1rem',borderRadius: '8px', width: '200px'}}>
        <h3>{nombre}</h3>
        <img
            src={imagen}
            alt={nombre}
            style={{width: '100%', height: '150px', objectFit: 'cover', borderRadius: '6px'}}
        />
        <p>Precio: ${precio}</p>
        <button onClick={alHacerClic} style={{marginTop:'10px'}}>
            Ver detalles
        </button>
    </div>
);
}

export default ProductCard;

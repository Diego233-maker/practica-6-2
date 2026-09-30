
CREATE TABLE productos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    precio NUMERIC(10, 2) NOT NULL,
    imagen VARCHAR(255)
);


CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    rol VARCHAR(20) NOT NULL DEFAULT 'cliente',
    creado TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE pedidos (
    id SERIAL PRIMARY KEY,
    total NUMERIC(10, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDIENTE',
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usuario_id INT REFERENCES usuarios(id) ON DELETE SET NULL
);


CREATE TABLE pedido_productos (
    pedido_id INT REFERENCES pedidos(id) ON DELETE CASCADE,
    producto_id INT REFERENCES productos(id) ON DELETE CASCADE,
    cantidad INT NOT NULL DEFAULT 1,
    PRIMARY KEY (pedido_id, producto_id)
);

insert into productos (nombre, precio, imagen) values 
('Brownies de Chocolate', 45.00, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT6Kr61VJfd31fTFkQuwtHNO5CZiGjKeWc4KTUn7dT3lyPUfDUoznk0DJ_7&s=10'),
('Galletas de Chispas', 20.00, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRAoFTEn3AVTpsZtRpZiNMIkwfXVJk80gekiQ5cFq8hMcmuSHXiNOxsv-4&s=10'),
('Pastel de Zanahoria', 250.00, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRDVGSdEX0hZa8MCoE2rUv2XUZIamDwBU4B6aPQm9DTQ8SYzaHCiCXxq1Vd&s=10'),
('Rol de Canela', 30.00, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS-lRUUPAc3EBz-tqJktLtpjCqEBmIpIgw6aLf-eHPqUDmVMQZXbLEvr6EK&s=10');

import { METODOS } from '../lib/pagos';
import type { MetodoPago } from '../types';

interface Props {
  metodos: MetodoPago[];
  seleccionado: MetodoPago;
  deshabilitado?: boolean;
  onChange: (metodo: MetodoPago) => void;
}

/** Lista de métodos de pago como tarjetas seleccionables (radio buttons accesibles). */
export default function MetodosPago({ metodos, seleccionado, deshabilitado, onChange }: Props) {
  return (
    <fieldset className="metodos-pago" disabled={deshabilitado}>
      <legend className="metodos-leyenda">Elige cómo quieres pagar</legend>
      {metodos.map((metodo) => {
        const info = METODOS[metodo];
        return (
          <label key={metodo} className={`metodo-opcion ${seleccionado === metodo ? 'activa' : ''}`}>
            <input
              type="radio"
              name="metodo-pago"
              value={metodo}
              checked={seleccionado === metodo}
              onChange={() => onChange(metodo)}
            />
            <span className="metodo-icono" aria-hidden="true">
              {info.icono}
            </span>
            <span className="metodo-texto">
              <strong>{info.etiqueta}</strong>
              <small>{info.descripcion}</small>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

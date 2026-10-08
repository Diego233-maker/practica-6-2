import { useEffect, useRef } from 'react';
import type { DatosTarjeta } from '../lib/mercadopago-cliente';
import type { ErroresTarjeta } from '../lib/tarjeta';

interface Props {
  valores: DatosTarjeta;
  errores: ErroresTarjeta;
  deshabilitado?: boolean;
  onChange: (valores: DatosTarjeta) => void;
  onSetCardTokenHandler?: (getCardToken: () => Promise<string | null>) => void;
}

export default function FormularioTarjeta({ valores, errores, deshabilitado, onChange }: Props) {
  const mpRef = useRef<any>(null);
  const valoresRef = useRef(valores);

  // Mantenemos una referencia actualizada de 'valores' para no perder datos en closures
  useEffect(() => {
    valoresRef.current = valores;
  }, [valores]);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).MercadoPago) {
      // 1. Inicializar Mercado Pago
      const mp = new (window as any).MercadoPago(import.meta.env.PUBLIC_MP_PUBLIC_KEY, {
        locale: 'es-MX',
      });
      mpRef.current = mp;
      
      // Asignar a window para que CheckoutView pueda acceder si es necesario
      (window as any).mpInstance = mp;

      // 2. Crear y montar los campos seguros
      const cardNumberElement = mp.fields.create('cardNumber', {
        placeholder: '0000 0000 0000 0000',
      }).mount('tc-numero');

      mp.fields.create('expirationDate', {
        placeholder: 'MM/AA',
      }).mount('tc-venc');

      mp.fields.create('securityCode', {
        placeholder: '123',
      }).mount('tc-cvv');

      // 3. Detectar la franquicia de la tarjeta (Visa, Mastercard, Amex, etc.)
      cardNumberElement.on('binChange', async ({ bin }: { bin: string }) => {
        if (!bin) return;
        try {
          const { results } = await mp.getPaymentMethods({ bin });
          if (results && results.length > 0) {
            onChange({
              ...valoresRef.current,
              paymentMethodId: results[0].id,
            });
          }
        } catch (e) {
          console.error('Error al detectar el método de pago:', e);
        }
      });
    }
  }, []);

  const cambiarTitular = (valor: string) => {
    onChange({ ...valores, titular: valor });
  };

  return (
    <div className="tarjeta-form">
      {/* NÚMERO DE TARJETA */}
      <div className="campo-pago">
        <label>Número de tarjeta</label>
        <div id="tc-numero" className="mp-input-container" />
        {errores.numero && <small className="campo-error">{errores.numero}</small>}
      </div>

      {/* TITULAR */}
      <div className="campo-pago">
        <label htmlFor="tc-titular">Nombre del titular</label>
        <input
          id="tc-titular"
          autoComplete="cc-name"
          placeholder="Como aparece en la tarjeta"
          value={valores.titular}
          disabled={deshabilitado}
          onChange={(e) => cambiarTitular(e.target.value)}
          aria-invalid={!!errores.titular}
        />
        {errores.titular && <small className="campo-error">{errores.titular}</small>}
      </div>

      <div className="fila-doble">
        {/* VENCIMIENTO */}
        <div className="campo-pago">
          <label>Vencimiento</label>
          <div id="tc-venc" className="mp-input-container" />
          {errores.vencimiento && <small className="campo-error">{errores.vencimiento}</small>}
        </div>

        {/* CVV */}
        <div className="campo-pago">
          <label>Código (CVV)</label>
          <div id="tc-cvv" className="mp-input-container" />
          {errores.cvv && <small className="campo-error">{errores.cvv}</small>}
        </div>
      </div>
    </div>
  );
}
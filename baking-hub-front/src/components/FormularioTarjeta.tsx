import { useEffect, useRef, useState } from 'react';
import { obtenerMercadoPago, type DatosTarjeta } from '../lib/mercadopago-cliente';
import type { ErroresTarjeta } from '../lib/tarjeta';
import type { ConfigPagos } from '../types';

interface Props {
  modo: ConfigPagos['modo'];
  valores: DatosTarjeta;
  errores: ErroresTarjeta;
  deshabilitado?: boolean;
  onChange: (valores: DatosTarjeta) => void;
}

export default function FormularioTarjeta({ modo, valores, errores, deshabilitado, onChange }: Props) {
  const valoresRef = useRef(valores);
  const [errorSdk, setErrorSdk] = useState<string | null>(null);

  useEffect(() => {
    valoresRef.current = valores;
  }, [valores]);

  useEffect(() => {
    if (modo !== 'real') return;

    const campos: Array<{ unmount?: () => void }> = [];
    try {
      const mp = obtenerMercadoPago();
      const numero = mp.fields.create('cardNumber', { placeholder: '0000 0000 0000 0000' }).mount('tc-numero');
      campos.push(numero);
      campos.push(mp.fields.create('expirationDate', { placeholder: 'MM/AA' }).mount('tc-venc'));
      campos.push(mp.fields.create('securityCode', { placeholder: '123' }).mount('tc-cvv'));
      setErrorSdk(null);

      numero.on('binChange', async ({ bin }) => {
        if (!bin) {
          onChange({ ...valoresRef.current, paymentMethodId: undefined });
          return;
        }
        try {
          const { results } = await mp.getPaymentMethods({ bin });
          onChange({ ...valoresRef.current, paymentMethodId: results?.[0]?.id });
        } catch (error) {
          console.error('Error al detectar el método de pago:', error);
        }
      });
    } catch (error) {
      console.error('No se pudieron montar los campos de Mercado Pago:', error);
      setErrorSdk(error instanceof Error ? error.message : 'No se pudo inicializar el pago con tarjeta.');
    }

    return () => {
      for (const campo of campos) campo.unmount?.();
    };
  }, [modo, onChange]);

  if (modo === 'simulado') {
    return (
      <p className="instrucciones" role="note">
        En modo demostración no se realiza ningún cargo ni necesitas ingresar datos de tarjeta. Al continuar, el pedido
        quedará marcado como pagado de forma simulada.
      </p>
    );
  }

  return (
    <div className="tarjeta-form">
      {errorSdk && (
        <p className="aviso-sdk" role="alert">
          {errorSdk}
        </p>
      )}

      <div className="campo-pago">
        <label htmlFor="tc-numero">Número de tarjeta</label>
        <div id="tc-numero" className="mp-input-container" />
      </div>

      <div className="campo-pago">
        <label htmlFor="tc-titular">Nombre del titular</label>
        <input
          id="tc-titular"
          autoComplete="cc-name"
          placeholder="Como aparece en la tarjeta"
          value={valores.titular}
          disabled={deshabilitado}
          onChange={(e) => onChange({ ...valores, titular: e.target.value })}
          aria-invalid={!!errores.titular}
        />
        {errores.titular && <small className="campo-error">{errores.titular}</small>}
      </div>

      <div className="fila-doble">
        <div className="campo-pago">
          <label htmlFor="tc-venc">Vencimiento</label>
          <div id="tc-venc" className="mp-input-container" />
        </div>
        <div className="campo-pago">
          <label htmlFor="tc-cvv">Código (CVV)</label>
          <div id="tc-cvv" className="mp-input-container" />
        </div>
      </div>
    </div>
  );
}

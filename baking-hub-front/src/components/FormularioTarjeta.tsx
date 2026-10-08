import { useEffect, useRef, useState } from 'react';
import type { DatosTarjeta } from '../lib/mercadopago-cliente';
import { formatearNumero, formatearVencimiento, type ErroresTarjeta } from '../lib/tarjeta';
import type { ConfigPagos } from '../types';

interface Props {
  /** "real": campos seguros de Mercado Pago (iframes) · "simulado": campos normales y token falso. */
  modo: ConfigPagos['modo'];
  valores: DatosTarjeta;
  errores: ErroresTarjeta;
  deshabilitado?: boolean;
  onChange: (valores: DatosTarjeta) => void;
}

const PUBLIC_KEY = (import.meta.env.PUBLIC_MP_PUBLIC_KEY as string | undefined)?.trim();

export default function FormularioTarjeta({ modo, valores, errores, deshabilitado, onChange }: Props) {
  const valoresRef = useRef(valores);
  const [errorSdk, setErrorSdk] = useState<string | null>(null);

  // Referencia siempre actualizada para que el callback de binChange no use valores viejos.
  useEffect(() => {
    valoresRef.current = valores;
  }, [valores]);

  // Modo real: monta los campos seguros de Mercado Pago y los desmonta al salir (si el cliente cambia
  // de método y regresa, se vuelven a crear en lugar de duplicarse).
  useEffect(() => {
    if (modo !== 'real') return;

    const MercadoPago = (window as any).MercadoPago;
    if (!PUBLIC_KEY) {
      setErrorSdk('Falta PUBLIC_MP_PUBLIC_KEY en baking-hub-front/.env (y reiniciar el servidor de Astro).');
      return;
    }
    if (!MercadoPago) {
      setErrorSdk('No se pudo cargar el SDK de Mercado Pago. Revisa tu conexión o desactiva el bloqueador de anuncios.');
      return;
    }
    setErrorSdk(null);

    const mp = (window as any).mpInstance ?? new MercadoPago(PUBLIC_KEY, { locale: 'es-MX' });
    (window as any).mpInstance = mp; // lo usa tokenizarTarjeta() para pedir el token

    const campos: Array<{ unmount?: () => void }> = [];
    try {
      const numero = mp.fields.create('cardNumber', { placeholder: '0000 0000 0000 0000' }).mount('tc-numero');
      campos.push(
        numero,
        mp.fields.create('expirationDate', { placeholder: 'MM/AA' }).mount('tc-venc'),
        mp.fields.create('securityCode', { placeholder: '123' }).mount('tc-cvv'),
      );

      // Detecta la franquicia (Visa, Mastercard, Amex…) con los primeros dígitos del número.
      numero.on('binChange', async ({ bin }: { bin?: string }) => {
        if (!bin) {
          onChange({ ...valoresRef.current, paymentMethodId: undefined });
          return;
        }
        try {
          const { results } = await mp.getPaymentMethods({ bin });
          if (results?.length) onChange({ ...valoresRef.current, paymentMethodId: results[0].id });
        } catch (e) {
          console.error('Error al detectar el método de pago:', e);
        }
      });
    } catch (e) {
      console.error('No se pudieron montar los campos de Mercado Pago:', e);
      setErrorSdk('No se pudo iniciar el formulario seguro de Mercado Pago. Revisa tu PUBLIC_MP_PUBLIC_KEY.');
    }

    return () => {
      for (const campo of campos) {
        try {
          campo.unmount?.();
        } catch {
          /* el campo ya no estaba montado */
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo]);

  return (
    <div className="tarjeta-form">
      {errorSdk && (
        <p className="aviso-sdk" role="alert">
          {errorSdk}
        </p>
      )}

      {/* NÚMERO DE TARJETA */}
      <div className="campo-pago">
        <label htmlFor={modo === 'real' ? undefined : 'tc-numero-sim'}>Número de tarjeta</label>
        {modo === 'real' ? (
          <div id="tc-numero" className="mp-input-container" />
        ) : (
          <input
            id="tc-numero-sim"
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder="4242 4242 4242 4242"
            value={valores.numero}
            disabled={deshabilitado}
            onChange={(e) => onChange({ ...valores, numero: formatearNumero(e.target.value) })}
            aria-invalid={!!errores.numero}
          />
        )}
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
          onChange={(e) => onChange({ ...valores, titular: e.target.value })}
          aria-invalid={!!errores.titular}
        />
        {errores.titular && <small className="campo-error">{errores.titular}</small>}
      </div>

      <div className="fila-doble">
        {/* VENCIMIENTO */}
        <div className="campo-pago">
          <label htmlFor={modo === 'real' ? undefined : 'tc-venc-sim'}>Vencimiento</label>
          {modo === 'real' ? (
            <div id="tc-venc" className="mp-input-container" />
          ) : (
            <input
              id="tc-venc-sim"
              inputMode="numeric"
              autoComplete="cc-exp"
              placeholder="MM/AA"
              value={valores.vencimiento}
              disabled={deshabilitado}
              onChange={(e) => onChange({ ...valores, vencimiento: formatearVencimiento(e.target.value) })}
              aria-invalid={!!errores.vencimiento}
            />
          )}
          {errores.vencimiento && <small className="campo-error">{errores.vencimiento}</small>}
        </div>

        {/* CVV */}
        <div className="campo-pago">
          <label htmlFor={modo === 'real' ? undefined : 'tc-cvv-sim'}>Código (CVV)</label>
          {modo === 'real' ? (
            <div id="tc-cvv" className="mp-input-container" />
          ) : (
            <input
              id="tc-cvv-sim"
              inputMode="numeric"
              autoComplete="cc-csc"
              placeholder="123"
              maxLength={4}
              value={valores.cvv}
              disabled={deshabilitado}
              onChange={(e) => onChange({ ...valores, cvv: e.target.value.replace(/\D/g, '') })}
              aria-invalid={!!errores.cvv}
            />
          )}
          {errores.cvv && <small className="campo-error">{errores.cvv}</small>}
        </div>
      </div>
    </div>
  );
}

import { GRAPHQL_URL } from 'astro:env/server';

/** Error devuelto por el backend (o por la red) con un código para decidir qué mostrar. */
export class ApiError extends Error {
  codigo: string;
  constructor(message: string, codigo = 'INTERNAL') {
    super(message);
    this.codigo = codigo;
  }
}

/** Ejecuta una query/mutation contra el backend GraphQL. Solo se usa en el servidor. */
export async function graphql<T>(
  query: string,
  variables: Record<string, unknown> = {},
  token?: string | null,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new ApiError('No se pudo conectar con el servidor', 'NETWORK');
  }

  const json = await res.json().catch(() => null);
  if (json?.errors?.length) {
    const [primero] = json.errors;
    throw new ApiError(primero.message, primero.extensions?.code ?? 'INTERNAL');
  }
  if (!res.ok || !json?.data) {
    throw new ApiError(`El servidor respondió con el estado ${res.status}`, 'HTTP');
  }
  return json.data as T;
}

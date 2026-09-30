import 'dotenv/config';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { GraphQLError } from 'graphql';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('❌ Falta JWT_SECRET (mínimo 32 caracteres) en tu archivo .env');
  console.error('   Genera uno con: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}

// Hash de relleno para que login tarde parecido exista o no el correo.
const HASH_RELLENO = bcrypt.hashSync('relleno-para-igualar-tiempos', 10);

export const errorDeUsuario = (mensaje) =>
  new GraphQLError(mensaje, { extensions: { code: 'BAD_USER_INPUT' } });

export const errorNoAutenticado = (mensaje = 'Debes iniciar sesión') =>
  new GraphQLError(mensaje, { extensions: { code: 'UNAUTHENTICATED' } });

export const errorProhibido = () =>
  new GraphQLError('No tienes permiso para hacer esto', { extensions: { code: 'FORBIDDEN' } });

export const hashPassword = (password) => bcrypt.hash(password, 10);

export const verificarPassword = (password, hash) => bcrypt.compare(password, hash ?? HASH_RELLENO);

export const firmarToken = (usuario) =>
  jwt.sign({ sub: String(usuario.id) }, JWT_SECRET, { expiresIn: '7d' });

/** Devuelve el id de usuario del header "Authorization: Bearer <token>", o null si falta o es inválido. */
export function idDesdeRequest(req) {
  const [tipo, token] = (req.headers.authorization ?? '').split(' ');
  if (tipo !== 'Bearer' || !token) return null;
  try {
    const { sub } = jwt.verify(token, JWT_SECRET);
    const id = Number(sub);
    return Number.isInteger(id) ? id : null;
  } catch {
    return null;
  }
}

/** Valida los datos de registro y devuelve los valores ya limpios. */
export function validarRegistro({ nombre, email, password }) {
  nombre = nombre.trim();
  email = email.trim().toLowerCase();
  if (nombre.length < 2 || nombre.length > 100) throw errorDeUsuario('El nombre debe tener entre 2 y 100 caracteres');
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw errorDeUsuario('El correo no es válido');
  if (password.length < 8) throw errorDeUsuario('La contraseña debe tener al menos 8 caracteres');
  // bcrypt solo usa los primeros 72 bytes; mejor rechazar que truncar en silencio.
  if (Buffer.byteLength(password) > 72) throw errorDeUsuario('La contraseña es demasiado larga (máximo 72 bytes)');
  return { nombre, email, password };
}

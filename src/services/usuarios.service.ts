import bcrypt from 'bcryptjs'
import * as db from '../db';
import { ALLOWED_ROLES, entero, texto, unoDe } from '../validacion';
import type { Usuario } from '../tipos';

const COSTO_BCRYPT = 12;
const ID_MAX = 2147483647;

/**
 * Servicio de usuarios.
 *
 * -----------------------------------------------------------------------------
 * FALLA — Inyección SQL (OWASP A03:2021)
 * -----------------------------------------------------------------------------
 * La consulta del login concatena el usuario y la contraseña directamente
 * dentro del texto SQL. El motor de PostgreSQL interpreta las comillas y los
 * operadores que venga en la entrada, de modo que la condición se puede
 * reescribir por completo y devolver una fila válida sin conocer la clave.
 *
 * Además:
 *  - La contraseña se compara en texto plano (almacenamiento inseguro).
 *  - El mensaje de error distingue "usuario inexistente" de "contraseña
 *    incorrecta" (enumeración de usuarios).
 *  - No hay límite de intentos (fuerza bruta).
 *
 * Corrección: consultas parametrizadas (`WHERE username = $1 AND password = $2`
 * con bcrypt.compare), mensaje genérico de error, y rate limiting + bloqueo
 * temporal en el endpoint de login.
 * -----------------------------------------------------------------------------
 */

/** Busca un usuario por nombre de usuario exacto (query parametrizada). */
export async function buscarPorUsername(username: string): Promise<Usuario | null> {
  const { rows } = await db.query<Usuario>(
    'SELECT * FROM usuarios WHERE username = $1',
    [username]
  );
  return rows[0] || null;
}


/**
 * Autentica comparando la contraseña con el hash guardado.
 * Devuelve el usuario o null; no distingue si falló el usuario o la clave.
 */
export async function autenticar(username: string, password: string): Promise<Usuario | null> {
  if (typeof username !== 'string' || typeof password !== 'string') return null;

  const { rows } = await db.query<Usuario>(
    'SELECT * FROM usuarios WHERE username = $1',
    [username]
  );
  const usuario = rows[0];
  if (!usuario) return null;

  const coincide = await bcrypt.compare(password, usuario.password);
  return coincide ? usuario : null;
}

/** Lista todos los usuarios (para el panel de administración). */
export async function listar(): Promise<Usuario[]> {
  const { rows } = await db.query<Usuario>('SELECT * FROM usuarios ORDER BY id');
  return rows;
}

/** Actualiza un usuario. La contraseña, si viene, se guarda hasheada. */
export async function actualizar(
  id: number | string,
  cambios: Partial<Usuario>
): Promise<Usuario | null> {
  const idValido = entero(id, 'id', 1, ID_MAX);
  const campos: string[] = [];
  const valores: unknown[] = [];

  if (cambios.username !== undefined) {
    campos.push(`username = $${valores.length + 1}`);
    valores.push(texto(cambios.username, 'username', 3, 40));
  }
  if (cambios.nombre !== undefined) {
    campos.push(`nombre = $${valores.length + 1}`);
    valores.push(texto(cambios.nombre, 'nombre', 2, 80));
  }
  if (cambios.rol !== undefined) {
    campos.push(`rol = $${valores.length + 1}`);
    valores.push(unoDe(cambios.rol, ALLOWED_ROLES, 'rol'));
  }
  if (cambios.password !== undefined) {
    const password = texto(cambios.password, 'contraseña', 8, 72);
    campos.push(`password = $${valores.length + 1}`);
    valores.push(await bcrypt.hash(password, COSTO_BCRYPT));
  }

  if (campos.length === 0) return null;

  valores.push(idValido);
  const { rows } = await db.query<Usuario>(
    `UPDATE usuarios SET ${campos.join(', ')} WHERE id = $${valores.length} RETURNING *`,
    valores
  );
  return rows[0] || null;
}

/** Cambia la contraseña de un usuario (se guarda en texto plano). */
export async function cambiarPassword(id: number, nuevaPassword: string): Promise<Usuario | null> {
  const { rows } = await db.query<Usuario>(
    'UPDATE usuarios SET password = $1 WHERE id = $2 RETURNING *',
    [nuevaPassword, id]
  );
  return rows[0] || null;
}

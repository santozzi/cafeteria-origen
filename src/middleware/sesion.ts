/**
 * Gestión de sesiones.
 *
 * Medidas de seguridad aplicadas:
 *  - El id de sesión es aleatorio (crypto.randomBytes, 256 bits): no se puede
 *    adivinar ni recorrer.
 *  - Al iniciar sesión se descarta el id anterior y se genera uno nuevo
 *    (evita la fijación de sesión).
 *  - Las sesiones vencen por inactividad (30 min) y tienen un máximo absoluto
 *    (8 h), aunque se sigan usando.
 *  - La cookie lleva httpOnly (JS no la lee), sameSite 'lax' (no viaja en
 *    POST de otros sitios) y secure en producción (sólo por HTTPS).
 *  - Cada sesión guarda su propio token anti-CSRF (ver csrf.ts).
 *  - El logout borra la sesión en el servidor (ver destruirSesion).
 */

import crypto from 'crypto';
import type { Request, Response } from 'express';

import config from '../config';
import type { Sesion, UsuarioSesion } from '../tipos';

export const sesiones = new Map<string, Sesion>();

const NOMBRE_COOKIE = 'sid';
const TTL_INACTIVIDAD = 30 * 60 * 1000; // 30 min sin usar la sesión
const TTL_ABSOLUTO = 8 * 60 * 60 * 1000; // 8 h desde el login, pase lo que pase

/**
 * Banderas de la cookie de sesión.
 * `secure` se activa en producción; en desarrollo la demo local corre sobre
 * HTTP plano y el navegador descartaría una cookie Secure.
 */
function opcionesCookie() {
  return {
    path: '/',
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax' as const,
  };
}

/** Lee las cookies de la petición (parser mínimo, sin dependencias). */
export function leerCookies(req: Request): Record<string, string> {
  const cookies: Record<string, string> = {};
  const header = req.headers.cookie;
  if (!header) return cookies;
  for (const parte of header.split(';')) {
    const separador = parte.indexOf('=');
    if (separador < 0) continue;
    const nombre = parte.slice(0, separador).trim();
    const valor = parte.slice(separador + 1).trim();
    if (!nombre) continue;
    try {
      cookies[nombre] = decodeURIComponent(valor);
    } catch {
      // Cookie mal codificada (por ejemplo "%"): se ignora en vez de romper.
    }
  }
  return cookies;
}

/** Crea una sesión nueva para el usuario y setea la cookie. */
export function crearSesion(req: Request, res: Response, usuario: UsuarioSesion): string {
  // Regenerar el id tras el login: si la petición traía un sid (por ejemplo
  // uno que un atacante le hizo fijar a la víctima), se invalida.
  destruirSesion(req);

  const id = crypto.randomBytes(32).toString('hex');
  const ahora = Date.now();

  sesiones.set(id, {
    usuario,
    creadaEn: ahora,
    expiraEn: ahora + TTL_INACTIVIDAD,
    csrfToken: crypto.randomBytes(32).toString('hex'),
  });

  res.cookie(NOMBRE_COOKIE, id, { ...opcionesCookie(), maxAge: TTL_ABSOLUTO });

  return id;
}

/**
 * Devuelve la sesión de la petición, si existe y no venció.
 * Cada uso renueva el plazo por inactividad, sin pasar el máximo absoluto.
 */
export function obtenerSesion(req: Request): Sesion | null {
  const cookies = leerCookies(req);
  const id = cookies[NOMBRE_COOKIE];
  if (!id) return null;

  const sesion = sesiones.get(id);
  if (!sesion) return null;

  const ahora = Date.now();
  if (ahora > sesion.expiraEn) {
    sesiones.delete(id);
    return null;
  }

  sesion.expiraEn = Math.min(ahora + TTL_INACTIVIDAD, sesion.creadaEn + TTL_ABSOLUTO);
  return sesion;
}

/** Cierra la sesión en el servidor (se llama en el logout y al re-loguearse). */
export function destruirSesion(req: Request): void {
  const cookies = leerCookies(req);
  const id = cookies[NOMBRE_COOKIE];
  if (id) sesiones.delete(id);
}

/** Borra la cookie de sesión del navegador (mismas banderas con las que se creó). */
export function limpiarCookieSesion(res: Response): void {
  res.clearCookie(NOMBRE_COOKIE, opcionesCookie());
}

// Barrido periódico: las sesiones abandonadas que nadie vuelve a usar no se
// quedan para siempre en memoria. unref() para no impedir que el proceso termine.
setInterval(() => {
  const ahora = Date.now();
  for (const [id, sesion] of sesiones) {
    if (ahora > sesion.expiraEn || ahora > sesion.creadaEn + TTL_ABSOLUTO) sesiones.delete(id);
  }
}, 10 * 60 * 1000).unref();
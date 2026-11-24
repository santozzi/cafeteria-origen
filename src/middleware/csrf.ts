import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';

import { obtenerSesion } from './sesion';

/**
 * Protección anti-CSRF.
 *
 * Cada sesión tiene su propio token aleatorio (se crea en el login, ver
 * sesion.ts). El front lo pide con GET /api/csrf-token y lo manda en la
 * cabecera X-CSRF-Token (también se acepta el campo `_csrf` del cuerpo o de
 * la query). Una página externa puede hacer que el navegador mande la cookie,
 * pero no puede leer el token (política del mismo origen), así que no puede
 * armar una petición válida.
 *
 * Capas:
 *  1. Token por sesión en POST/PUT/PATCH/DELETE.
 *  2. Cookie de sesión con SameSite=Lax (ver sesion.ts).
 *  3. Si el navegador manda Origin, tiene que ser el propio sitio.
 */

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

// El login todavía no tiene sesión (y por lo tanto, no tiene token).
const RUTAS_EXENTAS = new Set(['/auth/login']);

function rechazar(res: Response, mensaje: string) {
  return res.status(403).json({ error: mensaje, codigo: 'CSRF' });
}

/** Comparación en tiempo constante, para no filtrar el token por timing. */
function iguales(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

function tokenDeLaPeticion(req: Request): string {
  const cabecera = req.get('x-csrf-token');
  if (cabecera) return cabecera;
  if (req.body && typeof req.body._csrf === 'string') return req.body._csrf;
  if (typeof req.query._csrf === 'string') return req.query._csrf;
  return '';
}

/** Si viene la cabecera Origin, su host tiene que coincidir con el del sitio. */
function origenValido(req: Request): boolean {
  const origen = req.get('origin');
  if (!origen) return true; // curl, tests, navegadores que no la mandan
  try {
    return new URL(origen).host === req.get('host');
  } catch {
    return false; // "null" u origen mal formado
  }
}

/** GET /api/csrf-token — devuelve el token de la sesión actual. */
export function entregarTokenCsrf(req: Request, res: Response) {
  const sesion = obtenerSesion(req);
  res.set('Cache-Control', 'no-store');
  res.json({ token: sesion ? sesion.csrfToken : null });
}

/** Middleware: se monta sobre /api, antes de las rutas. */
export function protegerCsrf(req: Request, res: Response, next: NextFunction) {
  if (METODOS_SEGUROS.has(req.method)) return next();

  if (!origenValido(req)) return rechazar(res, 'Origen no permitido.');

  const ruta = req.path.toLowerCase().replace(/\/+$/, '');
  if (RUTAS_EXENTAS.has(ruta)) return next();

  // Sin sesión no hay credencial que un tercero pueda usar a nombre de la
  // víctima (por ejemplo, tomar un pedido es público): no hay nada que forjar.
  const sesion = obtenerSesion(req);
  if (!sesion) return next();

  const token = tokenDeLaPeticion(req);
  if (!token || !iguales(token, sesion.csrfToken)) {
    return rechazar(res, 'Token CSRF inválido o ausente.');
  }

  next();
}
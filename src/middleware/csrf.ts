import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';

const COOKIE_CSRF = 'csrf';
const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);
const RUTAS_EXENTAS = new Set(['/api/auth/login']);
const FORMATO_TOKEN = /^[a-f0-9]{64}$/;

function leerCookie(req: Request, nombre: string): string | null {
  const galletas = (req.headers.cookie || '').split(';');
  for (const galleta of galletas) {
    const [clave, ...valor] = galleta.trim().split('=');
    if (clave === nombre) return valor.join('=');
  }
  return null;
}

function mismoOrigen(req: Request): boolean {
  const origen = req.get('origin');
  if (origen) {
    try {
      return new URL(origen).host === req.get('host');
    } catch {
      return false;
    }
  }

  const referer = req.get('referer');
  if (referer) {
    try {
      return new URL(referer).host === req.get('host');
    } catch {
      return false;
    }
  }

  return true;
}

function iguales(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  return bufferA.length === bufferB.length && crypto.timingSafeEqual(bufferA, bufferB);
}

/** Devuelve el token de la cookie o genera uno nuevo. */
export function emitirTokenCsrf(req: Request, res: Response): void {
  const actual = leerCookie(req, COOKIE_CSRF);
  const token = actual && FORMATO_TOKEN.test(actual)
    ? actual
    : crypto.randomBytes(32).toString('hex');

  res.cookie(COOKIE_CSRF, token, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 1000,
  });

  res.json({ token });
}

/** Valida el token en los métodos que cambian estado. */
export function validarCsrf(req: Request, res: Response, next: NextFunction): void {
  if (METODOS_SEGUROS.has(req.method) || RUTAS_EXENTAS.has(req.path)) {
    next();
    return;
  }

  if (!mismoOrigen(req)) {
    res.status(403).json({ error: 'Solicitud rechazada.' });
    return;
  }

  const cookie = leerCookie(req, COOKIE_CSRF);
  const enviado = req.get('x-csrf-token') || req.body?._csrf || req.query?._csrf;

  if (
    typeof cookie !== 'string' ||
    typeof enviado !== 'string' ||
    !FORMATO_TOKEN.test(cookie) ||
    !FORMATO_TOKEN.test(enviado) ||
    !iguales(cookie, enviado)
  ) {
    res.status(403).json({ error: 'Token CSRF invalido o ausente.' });
    return;
  }

  next();
}

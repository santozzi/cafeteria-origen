/**
 * Manejo de errores.
 *
 * FALLA — Exposición de información sensible:
 * la respuesta al cliente incluye el mensaje de error original y el stack
 * trace completo, que revela rutas internas del servidor, nombres de tablas,
 * fragmentos de consultas SQL y versiones de librerías.
 *
 * Corrección: responder con un mensaje genérico ("Error interno") y registrar
 * el detalle real en el log del servidor.
 */

import type { NextFunction, Request, Response } from 'express';

import type { ErrorHttp } from '../tipos';

export function rutaNoEncontrada(req: Request, res: Response): void {
  res.status(404).json({ error: `Ruta no encontrada: ${req.originalUrl}` });
}

// Express reconoce al manejador de errores por sus CUATRO parámetros: `next`
// tiene que estar aunque no se use.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function manejadorErrores(err: ErrorHttp, req: Request, res: Response, next: NextFunction): void {
  // El detalle completo queda sólo en el log del servidor.
  console.error('[error]', err.stack || err.message);

  // Errores 4xx: son nuestros (validaciones) y el mensaje sirve al cliente.
  // Cualquier otro: mensaje genérico, sin stack ni detalles internos.
  const status = err.status && err.status >= 400 && err.status < 500 ? err.status : 500;
  const mensaje = status < 500 ? err.message : 'Error interno del servidor.';

  res.status(status).json({ error: mensaje });
}

import express from 'express';

import { requiereSesion, requiereRol } from '../middleware/auth';

const router = express.Router();

/**
 * Endpoint de diagnóstico: sólo para administradores y sin secretos.
 * Devuelve datos útiles para soporte, nunca variables de entorno ni credenciales.
 */
router.use(requiereSesion);
router.use(requiereRol('admin'));

router.get('/', (req, res) => {
  res.json({
    mensaje: 'Diagnóstico del servidor',
    version: '1.0.0',
    sistema: {
      node: process.version,
      uptimeSegundos: Math.round(process.uptime()),
    },
  });
});

export default router;

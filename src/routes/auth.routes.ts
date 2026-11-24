import express from 'express';
import * as usuarios from '../services/usuarios.service';
import {
  crearSesion,
  destruirSesion,
  limpiarCookieSesion,
  obtenerSesion,
} from '../middleware/sesion';

const router = express.Router();

/**
 * Inicio de sesión.
 *
 * FALLAS:
 *  - Inyección SQL en la verificación de credenciales (ver usuarios.service).
 *  - Contraseñas almacenadas en texto plano.
 *  - Mensajes de error que distinguen "usuario inexistente" de "contraseña
 *    incorrecta" → enumeración de usuarios.
 *  - Sin rate limiting ni bloqueo: fuerza bruta ilimitada.
 *  - El identificador de sesión no se regenera (fijación de sesión).
 */
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({ error: 'Falta usuario o contraseña.' });
    }

    // La verificación de credenciales es la consulta concatenada (SQLi).
    const usuario = await usuarios.autenticar(username, password);

    if (!usuario) {
      // FALLA — Enumeración de usuarios: el mensaje distingue entre
      // "no existe" y "contraseña incorrecta", lo que permite a un atacante
      // averiguar qué cuentas hay en el sistema.
      const existe = await usuarios.buscarPorUsername(username);
      if (existe) {
        return res.status(401).json({ error: 'La contraseña es incorrecta.' });
      }
      return res
        .status(401)
        .json({ error: `El usuario "${username}" no existe en el sistema.` });
    }

    crearSesion(req, res, {
      id: usuario.id,
      username: usuario.username,
      rol: usuario.rol,
      nombre: usuario.nombre,
    });

    res.json({
      mensaje: `¡Bienvenido, ${usuario.nombre}!`,
      usuario: {
        id: usuario.id,
        username: usuario.username,
        rol: usuario.rol,
        nombre: usuario.nombre,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Cierre de sesión.
 *
 * Borra la sesión del almacén del servidor (así una cookie robada deja de
 * servir) y también la cookie del navegador.
 */
router.post('/logout', (req, res) => {
  destruirSesion(req);
  limpiarCookieSesion(res);
  res.json({ mensaje: 'Sesión cerrada.' });
});

/** Devuelve el usuario de la sesión actual. */
router.get('/yo', (req, res) => {
  const sesion = obtenerSesion(req);
  if (!sesion) {
    return res.status(401).json({ error: 'Necesitás iniciar sesión.' });
  }
  res.json({ usuario: sesion.usuario });
});

export default router;

import { randomBytes } from 'crypto';
import path from 'path';

/** Configuración de la aplicación. Los secretos salen del entorno. */
export default {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',

  db: {
    host: process.env.DB_HOST || 'db',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'origen',
    user: process.env.DB_USER || 'origen_app',
    password: process.env.DB_PASSWORD || '',
  },

  sessionSecret: process.env.SESSION_SECRET || randomBytes(32).toString('hex'),

  // FALLA: credenciales por defecto que nunca se cambian.
  credencialesPorDefecto: {
    username: 'admin',
    password: 'admin',
  },

  uploadsDir: process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads'),
};

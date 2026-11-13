import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import courseRoutes from './routes/courses.js';
import { requireAuth } from './middleware.js';

// Límites por defecto del rate limiter. Los tests los suben para no chocar
// contra ellos, y bajan uno a propósito para comprobar que corta.
export const DEFAULT_RATE_LIMITS = {
  windowMs: 15 * 60 * 1000,
  login: 10,
  register: 5,
  auth: 60,
};

export function createApp({ rateLimits = {}, trustProxy = false } = {}) {
  if (!process.env.JWT_SECRET) {
    throw new Error('Falta JWT_SECRET en el archivo .env');
  }
  if (process.env.JWT_SECRET.length < 32) {
    const msg = 'JWT_SECRET es demasiado corto: usa al menos 32 caracteres aleatorios';
    if (process.env.NODE_ENV === 'production') throw new Error(msg);
    if (process.env.NODE_ENV !== 'test') console.warn(`Advertencia: ${msg}`);
  }

  const limits = { ...DEFAULT_RATE_LIMITS, ...rateLimits };
  const app = express();

  // Render, Fly y similares ponen un proxy delante. Sin esto el rate limiter
  // ve siempre la IP del proxy y limita a todos los usuarios como si fueran uno.
  if (trustProxy) app.set('trust proxy', 1);

  app.disable('x-powered-by');
  app.use(helmet({
    // La API se consume desde otro origen (Vercel), así que no puede quedar
    // restringida a same-origin.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));

  // CLIENT_URL acepta varios orígenes separados por coma (producción + previews).
  const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(cors({
    origin(origin, cb) {
      // Sin origin son peticiones que no vienen de un navegador (curl, health checks).
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error('Origen no permitido por CORS'));
    },
  }));

  // Un cuerpo JSON de esta app nunca pasa de unos pocos KB.
  app.use(express.json({ limit: '10kb' }));

  const limiter = (limit, extra = {}) => rateLimit({
    windowMs: limits.windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' },
    ...extra,
  });

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  // Los intentos exitosos no cuentan: a quien escribe bien su contraseña no se le limita.
  app.use('/api/auth/login', limiter(limits.login, { skipSuccessfulRequests: true }));
  app.use('/api/auth/register', limiter(limits.register));
  app.use('/api/auth', limiter(limits.auth), authRoutes);
  app.use('/api/courses', requireAuth, courseRoutes);

  app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

  // Manejador global de errores
  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'El cuerpo de la petición es demasiado grande' });
    }
    if (err instanceof SyntaxError && 'body' in err) {
      return res.status(400).json({ error: 'JSON inválido' });
    }
    if (err.message === 'Origen no permitido por CORS') {
      return res.status(403).json({ error: err.message });
    }
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ese registro ya existe' });
    }
    if (err.code === '22P02' || err.code === '23514') {
      return res.status(400).json({ error: 'Datos inválidos' });
    }

    if (process.env.NODE_ENV !== 'test') console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  });

  return app;
}

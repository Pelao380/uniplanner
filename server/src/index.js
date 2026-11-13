import 'dotenv/config';
import { createApp } from './app.js';
import { pool } from './db.js';

let app;
try {
  app = createApp({ trustProxy: process.env.NODE_ENV === 'production' });
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const port = process.env.PORT || 4000;
const server = app.listen(port, () => console.log(`🚀 API escuchando en http://localhost:${port}`));

// Render manda SIGTERM al desplegar: cerramos conexiones en vez de cortarlas.
const shutdown = (signal) => {
  console.log(`${signal} recibido, cerrando el servidor...`);
  server.close(() => {
    pool.end().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

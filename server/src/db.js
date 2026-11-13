import pg from 'pg';
import 'dotenv/config';

const { DATABASE_URL } = process.env;

if (!DATABASE_URL) {
  console.error('Falta DATABASE_URL en el archivo .env');
  process.exit(1);
}

// pg devuelve NUMERIC como string (para no perder precisión) y DATE como un
// Date en zona local. Sin esto la API responde weight: '30.00' en unos
// endpoints y 30 en otros, y las fechas se corren un día en husos al este de UTC.
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v))); // numeric
pg.types.setTypeParser(1082, (v) => v); // date -> 'YYYY-MM-DD' tal cual

// El SSL depende de dónde vive la base de datos, no del NODE_ENV: así la
// misma configuración sirve en local y en producción. Neon, Supabase y Render
// exigen SSL siempre, incluso cuando los consultas desde tu computador.
function needsSsl(url) {
  if (/[?&]sslmode=disable\b/.test(url)) return false;
  let hostname;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return true; // si no podemos leer la URL, mejor exigir SSL que exponer la conexión
  }
  return !['localhost', '127.0.0.1', '::1'].includes(hostname);
}

export const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  // rejectUnauthorized en true sí verifica el certificado: Neon y Supabase
  // entregan certificados de una CA pública, así que no hay que desactivarlo.
  ssl: needsSsl(DATABASE_URL) ? { rejectUnauthorized: true } : false,
});

// Sin este listener, cualquier error que emita el pool (Neon corta las
// conexiones inactivas en el plan gratuito) tumba el proceso completo.
pool.on('error', (err) => {
  console.error('Error inesperado en el pool de Postgres:', err.message);
});

export const query = (text, params) => pool.query(text, params);

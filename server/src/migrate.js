// Corre los .sql de ../migrations en orden alfabético (por eso van numerados).
//
// No lleva registro de cuáles ya se aplicaron: cada migración está escrita
// para poder repetirse sin romper nada (IF EXISTS / IF NOT EXISTS). Con dos o
// tres archivos eso sale más barato que una tabla de control; si algún día son
// veinte, toca cambiar a una herramienta de verdad.
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const carpeta = path.join(__dirname, '..', 'migrations');

try {
  const archivos = (await readdir(carpeta)).filter((f) => f.endsWith('.sql')).sort();

  if (archivos.length === 0) {
    console.log('No hay migraciones que correr.');
  }

  for (const archivo of archivos) {
    const sql = await readFile(path.join(carpeta, archivo), 'utf8');
    await pool.query(sql);
    console.log(`✅ ${archivo}`);
  }
} catch (err) {
  console.error('❌ Error al migrar:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}

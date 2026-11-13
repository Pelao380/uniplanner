import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sql = await readFile(path.join(__dirname, '..', 'schema.sql'), 'utf8');

try {
  await pool.query(sql);
  console.log('✅ Base de datos inicializada');
} catch (err) {
  console.error('❌ Error al inicializar la base de datos:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}

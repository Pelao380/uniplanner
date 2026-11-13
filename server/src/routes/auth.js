import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { query } from '../db.js';
import { asyncHandler, requireAuth, validate } from '../middleware.js';

const router = Router();

// 12 rondas: el estándar actual. Cada ronda duplica el costo de romper el hash.
// Decisión consciente: con bcryptjs (JavaScript puro) esto cuesta ~490 ms por
// login, contra ~120 ms con 10 rondas. Se prefiere la seguridad. Si el login
// se vuelve un problema, la salida NO es bajar las rondas sino cambiar a
// 'bcrypt' (nativo), que hace lo mismo en ~60 ms.
const BCRYPT_ROUNDS = 12;

// bcrypt ignora en silencio todo lo que pase de 72 bytes, así que una
// contraseña más larga daría una falsa sensación de seguridad. Mejor avisar.
const password = z
  .string()
  .min(8, 'Mínimo 8 caracteres')
  .refine((p) => Buffer.byteLength(p, 'utf8') <= 72, 'Máximo 72 bytes');

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(100),
  email: z.string().trim().toLowerCase().email('Email inválido').max(255),
  password,
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(1),
});

const signToken = (userId) =>
  jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });

// Hash de descarte para comparar también cuando el email no existe: sin esto,
// un login con email inexistente responde mucho más rápido que uno con email
// real, y esa diferencia de tiempo permite averiguar quién tiene cuenta.
let dummyHash = null;
const getDummyHash = async () => {
  dummyHash ??= await bcrypt.hash('cuenta-inexistente', BCRYPT_ROUNDS);
  return dummyHash;
};

router.post('/register', validate(registerSchema), asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // Nos apoyamos en el UNIQUE de la tabla en vez de consultar antes: dos
  // registros simultáneos con el mismo email pasarían ambos ese chequeo.
  try {
    const { rows } = await query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, hash]
    );
    res.status(201).json({ user: rows[0], token: signToken(rows[0].id) });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese email' });
    }
    throw err;
  }
}));

router.post('/login', validate(loginSchema), asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const { rows } = await query(
    'SELECT id, name, email, password_hash FROM users WHERE email = $1',
    [email]
  );
  const user = rows[0];
  const hash = user ? user.password_hash : await getDummyHash();
  const matches = await bcrypt.compare(password, hash);

  if (!user || !matches) {
    return res.status(401).json({ error: 'Email o contraseña incorrectos' });
  }
  res.json({
    user: { id: user.id, name: user.name, email: user.email },
    token: signToken(user.id),
  });
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT id, name, email FROM users WHERE id = $1', [req.userId]);
  if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ user: rows[0] });
}));

export default router;

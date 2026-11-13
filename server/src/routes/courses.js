import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { asyncHandler, validate, validateParams } from '../middleware.js';
import { summarize, MIN_GRADE, MAX_GRADE } from '../grades.js';

const router = Router();

const courseSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(150),
  code: z.string().trim().max(30).optional().nullable(),
  semester: z.string().trim().max(20).optional().nullable(),
  professor: z.string().trim().max(150).optional().nullable(),
});

const evaluationSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(150),
  weight: z.coerce.number().gt(0, 'La ponderación debe ser mayor que 0').max(100),
  grade: z.coerce.number().min(MIN_GRADE).max(MAX_GRADE).optional().nullable(),
  due_date: z.string().date().optional().nullable(),
});

// Un id que no es un entero positivo no existe: 404, no un 500 de Postgres.
const id = z.coerce.number().int().positive();
const courseParams = validateParams(z.object({ id }));
const evalParams = validateParams(z.object({ id, evalId: id }));

// Obtiene el ramo solo si pertenece al usuario autenticado
async function findOwnedCourse(courseId, userId) {
  const { rows } = await query('SELECT * FROM courses WHERE id = $1 AND user_id = $2', [courseId, userId]);
  return rows[0];
}

async function getEvaluations(courseId) {
  const { rows } = await query(
    'SELECT * FROM evaluations WHERE course_id = $1 ORDER BY due_date NULLS LAST, id',
    [courseId]
  );
  return rows;
}

// Las ponderaciones de un ramo no pueden pasar de 100%. Se valida en el
// servidor, no solo con un aviso en la interfaz: el cálculo de notas depende
// de que el dato sea válido.
async function weightOverflow(courseId, weight, excludeEvalId = 0) {
  const { rows } = await query(
    'SELECT COALESCE(SUM(weight), 0) AS total FROM evaluations WHERE course_id = $1 AND id <> $2',
    [courseId, excludeEvalId]
  );
  const total = Number(rows[0].total) + Number(weight);
  return total > 100 ? Math.round(total * 100) / 100 : null;
}

// ---------- Ramos ----------
router.get('/', asyncHandler(async (req, res) => {
  const { rows: courses } = await query(
    'SELECT * FROM courses WHERE user_id = $1 ORDER BY created_at DESC',
    [req.userId]
  );
  const result = await Promise.all(
    courses.map(async (c) => ({ ...c, summary: summarize(await getEvaluations(c.id)) }))
  );
  res.json(result);
}));

router.post('/', validate(courseSchema), asyncHandler(async (req, res) => {
  const { name, code, semester, professor } = req.body;
  const { rows } = await query(
    `INSERT INTO courses (user_id, name, code, semester, professor)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [req.userId, name, code || null, semester || null, professor || null]
  );
  res.status(201).json({ ...rows[0], summary: summarize([]) });
}));

router.get('/:id', courseParams, asyncHandler(async (req, res) => {
  const course = await findOwnedCourse(req.params.id, req.userId);
  if (!course) return res.status(404).json({ error: 'Ramo no encontrado' });
  const evaluations = await getEvaluations(course.id);
  res.json({ ...course, evaluations, summary: summarize(evaluations) });
}));

router.put('/:id', courseParams, validate(courseSchema), asyncHandler(async (req, res) => {
  const { name, code, semester, professor } = req.body;
  const { rows } = await query(
    `UPDATE courses SET name = $1, code = $2, semester = $3, professor = $4
     WHERE id = $5 AND user_id = $6 RETURNING *`,
    [name, code || null, semester || null, professor || null, req.params.id, req.userId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Ramo no encontrado' });
  res.json(rows[0]);
}));

router.delete('/:id', courseParams, asyncHandler(async (req, res) => {
  const { rowCount } = await query('DELETE FROM courses WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
  if (!rowCount) return res.status(404).json({ error: 'Ramo no encontrado' });
  res.status(204).end();
}));

// ---------- Evaluaciones (anidadas en el ramo) ----------
router.post('/:id/evaluations', courseParams, validate(evaluationSchema), asyncHandler(async (req, res) => {
  const course = await findOwnedCourse(req.params.id, req.userId);
  if (!course) return res.status(404).json({ error: 'Ramo no encontrado' });
  const { name, weight, grade, due_date } = req.body;

  const total = await weightOverflow(course.id, weight);
  if (total !== null) {
    return res.status(422).json({ error: `Las ponderaciones del ramo sumarían ${total}%, más del 100% permitido` });
  }

  const { rows } = await query(
    `INSERT INTO evaluations (course_id, name, weight, grade, due_date)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [course.id, name, weight, grade ?? null, due_date || null]
  );
  res.status(201).json(rows[0]);
}));

router.put('/:id/evaluations/:evalId', evalParams, validate(evaluationSchema), asyncHandler(async (req, res) => {
  const course = await findOwnedCourse(req.params.id, req.userId);
  if (!course) return res.status(404).json({ error: 'Ramo no encontrado' });
  const { name, weight, grade, due_date } = req.body;

  const total = await weightOverflow(course.id, weight, req.params.evalId);
  if (total !== null) {
    return res.status(422).json({ error: `Las ponderaciones del ramo sumarían ${total}%, más del 100% permitido` });
  }

  const { rows } = await query(
    `UPDATE evaluations SET name = $1, weight = $2, grade = $3, due_date = $4
     WHERE id = $5 AND course_id = $6 RETURNING *`,
    [name, weight, grade ?? null, due_date || null, req.params.evalId, course.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Evaluación no encontrada' });
  res.json(rows[0]);
}));

router.delete('/:id/evaluations/:evalId', evalParams, asyncHandler(async (req, res) => {
  const course = await findOwnedCourse(req.params.id, req.userId);
  if (!course) return res.status(404).json({ error: 'Ramo no encontrado' });
  const { rowCount } = await query(
    'DELETE FROM evaluations WHERE id = $1 AND course_id = $2',
    [req.params.evalId, course.id]
  );
  if (!rowCount) return res.status(404).json({ error: 'Evaluación no encontrada' });
  res.status(204).end();
}));

export default router;

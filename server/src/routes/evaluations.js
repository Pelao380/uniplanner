import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { asyncHandler } from '../middleware.js';

const router = Router();

// "Hoy" lo decide el cliente, no el servidor. La API corre en Virginia (UTC)
// y los usuarios están en Chile (UTC-3/-4): a las 22:00 en Santiago el
// servidor ya está en el día siguiente y escondería la prueba de esa noche.
const upcomingQuery = z.object({
  desde: z.string().date('desde debe ser una fecha YYYY-MM-DD'),
});

// Las evaluaciones con fecha desde `desde` en adelante, de todos los ramos del
// usuario y con el nombre del ramo al lado. Es la lista de "Futuras
// evaluaciones" y también la que usa la app para agendar los recordatorios.
// Las que no tienen fecha no aparecen: no hay cuándo avisarlas.
router.get('/upcoming', asyncHandler(async (req, res) => {
  const parsed = upcomingQuery.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Datos inválidos',
      details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }

  const { rows } = await query(
    `SELECT e.id, e.course_id, c.name AS course_name, e.name, e.weight, e.grade, e.due_date
       FROM evaluations e
       JOIN courses c ON c.id = e.course_id
      WHERE c.user_id = $1 AND e.due_date >= $2
      ORDER BY e.due_date, c.name, e.id`,
    [req.userId, parsed.data.desde]
  );
  res.json(rows);
}));

export default router;

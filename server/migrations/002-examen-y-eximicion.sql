-- Nota de presentación + examen.
--
-- Con estas dos columnas el 100% de las evaluaciones de un ramo deja de ser el
-- ramo entero y pasa a ser su nota de presentación; el examen vale el resto.
--
-- Las dos quedan en NULL para los ramos que ya existen, y NULL significa
-- "este ramo no tiene examen": se siguen calculando exactamente como antes.
--
-- Repetible: si ya se aplicó, no hace nada.
ALTER TABLE courses ADD COLUMN IF NOT EXISTS exam_weight     NUMERIC(5,2);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS exemption_grade NUMERIC(2,1);

-- Los mismos CHECK que trae schema.sql, para una base que ya existía.
-- Postgres no tiene ADD CONSTRAINT IF NOT EXISTS, así que se pregunta antes.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'courses_exam_weight_check') THEN
    ALTER TABLE courses ADD CONSTRAINT courses_exam_weight_check
      CHECK (exam_weight > 0 AND exam_weight < 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'courses_exemption_grade_check') THEN
    ALTER TABLE courses ADD CONSTRAINT courses_exemption_grade_check
      CHECK (exemption_grade >= 1.0 AND exemption_grade <= 7.0);
  END IF;
END $$;

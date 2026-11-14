-- Esquema de la base de datos de UniPlanner
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS courses (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       VARCHAR(150) NOT NULL,
  semester   VARCHAR(20),
  -- Examen final. NULL en los dos = el ramo no tiene examen y las
  -- ponderaciones de sus evaluaciones son el 100% de la nota.
  exam_weight     NUMERIC(5,2) CHECK (exam_weight > 0 AND exam_weight < 100),
  exemption_grade NUMERIC(2,1) CHECK (exemption_grade >= 1.0 AND exemption_grade <= 7.0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS evaluations (
  id         SERIAL PRIMARY KEY,
  course_id  INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name       VARCHAR(150) NOT NULL,
  weight     NUMERIC(5,2) NOT NULL CHECK (weight > 0 AND weight <= 100),
  grade      NUMERIC(2,1) CHECK (grade >= 1.0 AND grade <= 7.0),
  due_date   DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_courses_user ON courses(user_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_course ON evaluations(course_id);

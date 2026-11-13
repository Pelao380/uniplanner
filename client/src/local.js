// Modo invitado: los mismos métodos que api.js, pero contra localStorage.
//
// La idea es que el resto de la app no sepa con cuál de los dos está hablando
// (ver store.js). Por eso acá se repiten las validaciones y los mensajes de
// error del servidor: si cambian en un lado y no en el otro, el usuario ve
// una app que se comporta distinto según si tiene cuenta o no.

import { summarize, MIN_GRADE, MAX_GRADE } from './grades.js';

const CLAVE = 'uniplanner:invitado';
const vacio = () => ({ courses: [], evaluations: [], nextId: 1 });

function leer() {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return vacio();
    const d = JSON.parse(crudo);
    return {
      courses: Array.isArray(d.courses) ? d.courses : [],
      evaluations: Array.isArray(d.evaluations) ? d.evaluations : [],
      nextId: Number(d.nextId) || 1,
    };
  } catch {
    // JSON corrupto o localStorage bloqueado: mejor empezar limpio que romper la app.
    return vacio();
  }
}

function escribir(d) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(d));
  } catch {
    throw new Error(
      'Este navegador no está guardando datos (modo incógnito o sin espacio). Crea una cuenta para no perder lo que escribas.'
    );
  }
}

// ---------- Validaciones (las mismas que hace Zod en el servidor) ----------
const textoObligatorio = (v, max) => {
  const s = String(v ?? '').trim();
  if (!s) throw new Error('El nombre es obligatorio');
  if (s.length > max) throw new Error(`El nombre no puede pasar de ${max} caracteres`);
  return s;
};

const textoOpcional = (v, max) => {
  const s = String(v ?? '').trim();
  if (!s) return null;
  if (s.length > max) throw new Error(`Ese campo no puede pasar de ${max} caracteres`);
  return s;
};

function validarRamo(datos) {
  return {
    name: textoObligatorio(datos.name, 150),
    semester: textoOpcional(datos.semester, 20),
  };
}

function validarEvaluacion(datos) {
  const weight = Number(datos.weight);
  if (!Number.isFinite(weight) || weight <= 0) throw new Error('La ponderación debe ser mayor que 0');
  if (weight > 100) throw new Error('La ponderación no puede pasar de 100');

  let grade = null;
  if (datos.grade !== null && datos.grade !== undefined && datos.grade !== '') {
    grade = Number(datos.grade);
    if (!Number.isFinite(grade) || grade < MIN_GRADE || grade > MAX_GRADE) {
      throw new Error(`La nota debe estar entre ${MIN_GRADE.toFixed(1)} y ${MAX_GRADE.toFixed(1)}`);
    }
  }

  const due = datos.due_date || null;
  if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) throw new Error('La fecha no es válida');

  return { name: textoObligatorio(datos.name, 150), weight, grade, due_date: due };
}

// Igual que weightOverflow() en el servidor: devuelve el total que se pasaría, o null.
function sobrepeso(d, courseId, weight, excluirEvalId = 0) {
  const suma = d.evaluations
    .filter((e) => e.course_id === courseId && e.id !== excluirEvalId)
    .reduce((s, e) => s + Number(e.weight), 0);
  const total = Math.round((suma + Number(weight)) * 100) / 100;
  return total > 100 ? total : null;
}

// ---------- Lectura ----------
const buscarRamo = (d, id) => d.courses.find((c) => c.id === Number(id));

// ORDER BY due_date NULLS LAST, id
const evaluacionesDe = (d, courseId) =>
  d.evaluations
    .filter((e) => e.course_id === courseId)
    .sort((a, b) => {
      if (a.due_date === b.due_date) return a.id - b.id;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date < b.due_date ? -1 : 1;
    });

const sinRamo = () => { throw new Error('Ramo no encontrado'); };
const sinEvaluacion = () => { throw new Error('Evaluación no encontrada'); };

// ---------- Interfaz pública, misma forma que api.js ----------
export const local = {
  // ORDER BY created_at DESC
  async listCourses() {
    const d = leer();
    return [...d.courses]
      .sort((a, b) => (a.created_at === b.created_at ? b.id - a.id : a.created_at < b.created_at ? 1 : -1))
      .map((c) => ({ ...c, summary: summarize(evaluacionesDe(d, c.id)) }));
  },

  async getCourse(id) {
    const d = leer();
    const curso = buscarRamo(d, id);
    if (!curso) sinRamo();
    const evaluations = evaluacionesDe(d, curso.id);
    return { ...curso, evaluations, summary: summarize(evaluations) };
  },

  async createCourse(datos) {
    const d = leer();
    const curso = { id: d.nextId, ...validarRamo(datos), created_at: new Date().toISOString() };
    d.nextId += 1;
    d.courses.push(curso);
    escribir(d);
    return { ...curso, summary: summarize([]) };
  },

  async updateCourse(id, datos) {
    const d = leer();
    const curso = buscarRamo(d, id);
    if (!curso) sinRamo();
    Object.assign(curso, validarRamo(datos));
    escribir(d);
    return curso;
  },

  async deleteCourse(id) {
    const d = leer();
    const curso = buscarRamo(d, id);
    if (!curso) sinRamo();
    d.courses = d.courses.filter((c) => c.id !== curso.id);
    d.evaluations = d.evaluations.filter((e) => e.course_id !== curso.id); // ON DELETE CASCADE
    escribir(d);
    return null;
  },

  async createEvaluation(courseId, datos) {
    const d = leer();
    const curso = buscarRamo(d, courseId);
    if (!curso) sinRamo();
    const ev = validarEvaluacion(datos);

    const total = sobrepeso(d, curso.id, ev.weight);
    if (total !== null) {
      throw new Error(`Las ponderaciones del ramo sumarían ${total}%, más del 100% permitido`);
    }

    const nueva = { id: d.nextId, course_id: curso.id, ...ev };
    d.nextId += 1;
    d.evaluations.push(nueva);
    escribir(d);
    return nueva;
  },

  async updateEvaluation(courseId, evalId, datos) {
    const d = leer();
    const curso = buscarRamo(d, courseId);
    if (!curso) sinRamo();
    const actual = d.evaluations.find((e) => e.id === Number(evalId) && e.course_id === curso.id);
    if (!actual) sinEvaluacion();
    const ev = validarEvaluacion(datos);

    const total = sobrepeso(d, curso.id, ev.weight, actual.id);
    if (total !== null) {
      throw new Error(`Las ponderaciones del ramo sumarían ${total}%, más del 100% permitido`);
    }

    Object.assign(actual, ev);
    escribir(d);
    return actual;
  },

  async deleteEvaluation(courseId, evalId) {
    const d = leer();
    const curso = buscarRamo(d, courseId);
    if (!curso) sinRamo();
    const antes = d.evaluations.length;
    d.evaluations = d.evaluations.filter((e) => !(e.id === Number(evalId) && e.course_id === curso.id));
    if (d.evaluations.length === antes) sinEvaluacion();
    escribir(d);
    return null;
  },
};

// ---------- Para migrar los datos a una cuenta ----------
export const invitado = {
  cuantosRamos: () => leer().courses.length,

  // Los ramos con sus evaluaciones, listos para subirlos a la API.
  contenido() {
    const d = leer();
    return d.courses.map((c) => ({
      curso: { name: c.name, semester: c.semester },
      evaluaciones: evaluacionesDe(d, c.id).map((e) => ({
        name: e.name, weight: e.weight, grade: e.grade, due_date: e.due_date,
      })),
    }));
  },

  limpiar() {
    try { localStorage.removeItem(CLAVE); } catch { /* si falla, da lo mismo */ }
  },
};

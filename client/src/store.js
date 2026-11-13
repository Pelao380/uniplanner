// De dónde salen y dónde se guardan los ramos.
//
// Con sesión iniciada, del servidor. Sin cuenta, de este navegador. Las dos
// implementaciones exponen exactamente los mismos métodos, así que las
// páginas llaman a db.* y no se enteran de cuál está detrás.
//
// La decisión se toma en cada llamada, no al cargar el módulo: el usuario
// puede crear una cuenta a mitad de uso y desde ahí todo debe ir al servidor
// sin recargar la página.

import { api, tokenStore } from './api.js';
import { local } from './local.js';

const backend = () => (tokenStore.get() ? api : local);

export const db = {
  listCourses: () => backend().listCourses(),
  getCourse: (id) => backend().getCourse(id),
  createCourse: (datos) => backend().createCourse(datos),
  updateCourse: (id, datos) => backend().updateCourse(id, datos),
  deleteCourse: (id) => backend().deleteCourse(id),

  createEvaluation: (courseId, datos) => backend().createEvaluation(courseId, datos),
  updateEvaluation: (courseId, evalId, datos) => backend().updateEvaluation(courseId, evalId, datos),
  deleteEvaluation: (courseId, evalId) => backend().deleteEvaluation(courseId, evalId),
};

// ⚠️ COPIA EXACTA de server/src/grades.js, a propósito.
//
// El modo invitado calcula las notas en el navegador, sin pasar por la API,
// así que esta lógica tiene que existir en los dos lados. Un paquete
// compartido obligaría a configurar el build de Vercel para leer archivos
// fuera de client/; para 60 líneas de aritmética pura no vale la pena.
//
// Para que las dos copias no se separen con el tiempo, scripts/check-grades-parity.mjs
// compara las dos implementaciones con miles de casos y corre en cada push.
// Si tocas una, tienes que tocar la otra: el CI se cae si no.

// Cálculos de notas en escala chilena (1.0 a 7.0, aprobación con 4.0)

export const MIN_GRADE = 1.0;
export const MAX_GRADE = 7.0;
export const PASSING_GRADE = 4.0;

// ¿La nota final se redondea a un decimal antes de decidir si aprueba?
//   true  -> un 3.95 se informa como 4.0 y aprueba (lo habitual en Chile)
//   false -> hay que llegar a 4.0 exacto
// Esta es LA regla del dominio: vive en un solo lugar y los tests la fijan.
export const ROUNDS_FINAL_GRADE = true;

// Promedio real mínimo que hay que alcanzar, ya considerando el redondeo.
const PASSING_THRESHOLD = ROUNDS_FINAL_GRADE ? PASSING_GRADE - 0.05 : PASSING_GRADE;

const EPSILON = 1e-9;
const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;
// Techo a un decimal: nunca prometemos una nota más baja que la realmente necesaria.
const ceil1 = (n) => Math.ceil(n * 10 - EPSILON) / 10;

export function summarize(evaluations) {
  const graded = evaluations.filter((e) => e.grade !== null && e.grade !== undefined);
  const totalWeight = evaluations.reduce((s, e) => s + Number(e.weight), 0);
  const gradedWeight = graded.reduce((s, e) => s + Number(e.weight), 0);
  const weightedSum = graded.reduce((s, e) => s + Number(e.grade) * Number(e.weight), 0);

  // Promedio de lo rendido hasta ahora, sobre el peso rendido (no sobre 100).
  const currentAverage = gradedWeight > 0 ? round1(weightedSum / gradedWeight) : null;

  // Las ponderaciones son porcentaje del ramo: por definición suman 100. Si
  // suman menos, es que faltan evaluaciones por declarar, y ese hueco cuenta
  // como pendiente. totalWeight solo sirve para avisarle al usuario.
  const remainingWeight = round2(Math.max(100 - gradedWeight, 0));

  let neededToPass = null;
  let status;

  if (remainingWeight <= 0) {
    // Ya se rindió el 100%: el ramo está cerrado.
    status = weightedSum / gradedWeight >= PASSING_THRESHOLD ? 'aprobado' : 'reprobado';
  } else {
    const raw = (PASSING_THRESHOLD * 100 - weightedSum) / remainingWeight;
    if (raw > MAX_GRADE) {
      // Ni con un 7.0 en todo lo que queda alcanza: el resultado ya está decidido.
      status = 'imposible';
    } else if (raw <= MIN_GRADE) {
      status = 'asegurado'; // aprueba pase lo que pase
      neededToPass = MIN_GRADE;
    } else {
      status = gradedWeight === 0 ? 'sin-notas' : 'en-curso';
      neededToPass = ceil1(raw);
    }
  }

  return {
    currentAverage,
    totalWeight: round2(totalWeight),
    gradedWeight: round2(gradedWeight),
    remainingWeight,
    neededToPass,
    status,
  };
}

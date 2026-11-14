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

// El mismo redondeo que para aprobar, aplicado a cualquier umbral: si te eximes
// con 5.0 y sacas 4.95, la universidad informa 5.0 y te eximes.
const umbralReal = (nota) => (ROUNDS_FINAL_GRADE ? nota - 0.05 : nota);

// Un examen solo cuenta si vale algo y no lo vale todo. Fuera de ese rango el
// ramo simplemente no tiene examen y el cálculo es el de siempre.
function normalizarExamen(examen) {
  const weight = Number(examen?.examWeight);
  if (!Number.isFinite(weight) || weight <= 0 || weight >= 100) return null;
  const umbral = Number(examen?.exemptionGrade);
  return {
    examWeight: round2(weight),
    // Sin nota de eximición el ramo igual tiene examen: lo rinde todo el mundo.
    exemptionGrade: Number.isFinite(umbral) && umbral >= MIN_GRADE && umbral <= MAX_GRADE
      ? round1(umbral)
      : null,
  };
}

// `examen` es opcional: { examWeight, exemptionGrade }.
//
// Sin examen, las ponderaciones de las evaluaciones son el 100% del ramo y el
// resultado es exactamente el de siempre.
//
// Con examen, ese 100% pasa a ser la NOTA DE PRESENTACIÓN, y la final sale de
// combinarla con el examen:
//
//     final = presentación × (100 − examWeight)%  +  examen × examWeight%
//
// salvo que te eximas, en cuyo caso la presentación es la nota final.
export function summarize(evaluations, examen) {
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

  const base = {
    currentAverage,
    totalWeight: round2(totalWeight),
    gradedWeight: round2(gradedWeight),
    remainingWeight,
    neededToPass,
    status,
  };

  const conExamen = normalizarExamen(examen);
  if (!conExamen) return base;

  return { ...base, ...resolverExamen(base, { weightedSum, gradedWeight, remainingWeight }, conExamen) };
}

// Todo lo que el examen agrega encima del cálculo de la presentación.
function resolverExamen(base, acumulado, { examWeight, exemptionGrade }) {
  const { weightedSum, gradedWeight, remainingWeight } = acumulado;
  const pesoExamen = examWeight / 100;
  const pesoPresentacion = 1 - pesoExamen;

  // La presentación está cerrada cuando ya se rindió el 100% de las evaluaciones.
  const presentationIsFinal = gradedWeight > 0 && remainingWeight <= 0;
  // Se usa la presentación REDONDEADA porque es la que informa la universidad
  // y la que el usuario ve en pantalla: con 4.94 el cálculo parte de 4.9.
  const presentation = base.currentAverage;

  // --- ¿Se exime? ---
  let exempt = null;
  let neededForExemption = null;

  if (exemptionGrade !== null) {
    const umbral = umbralReal(exemptionGrade);
    if (presentationIsFinal) {
      exempt = weightedSum / gradedWeight >= umbral;
    } else {
      // Todavía no: falta rendir. Lo útil es cuánto necesita en lo que queda.
      exempt = false;
      const raw = (umbral * 100 - weightedSum) / remainingWeight;
      if (raw <= MIN_GRADE) neededForExemption = MIN_GRADE;
      else if (raw <= MAX_GRADE) neededForExemption = ceil1(raw);
      // Si pasa de 7.0, eximirse ya no es posible y queda en null.
    }
  }

  // --- ¿Qué nota necesita en el examen? ---
  // Con la presentación incompleta el número igual se calcula, pero sobre lo
  // que lleva hasta ahora: por eso va marcado como provisional.
  let neededInExam = null;
  let examStatus = null;

  if (presentation !== null && exempt !== true) {
    const raw = (PASSING_THRESHOLD - presentation * pesoPresentacion) / pesoExamen;
    if (raw > MAX_GRADE) examStatus = 'imposible';
    else if (raw <= MIN_GRADE) {
      examStatus = 'asegurado';
      neededInExam = MIN_GRADE;
    } else {
      examStatus = 'en-curso';
      neededInExam = ceil1(raw);
    }
  }

  // --- Estado del ramo, que ahora lo decide el examen y no la presentación ---
  let status;
  if (gradedWeight === 0) {
    status = 'sin-notas';
  } else if (!presentationIsFinal) {
    // Mientras falten notas de presentación nada está decidido: hasta un
    // "imposible" del examen puede darse vuelta con las que faltan.
    status = 'en-curso';
  } else if (exempt === true) {
    status = presentation >= PASSING_THRESHOLD ? 'aprobado' : 'reprobado';
  } else {
    status = examStatus;
  }

  return {
    examWeight,
    exemptionGrade,
    presentationGrade: presentation,
    presentationIsFinal,
    exempt,
    neededForExemption,
    neededInExam,
    // El número de arriba va a cambiar con las notas que falten declarar.
    neededInExamIsProvisional: !presentationIsFinal,
    status,
  };
}

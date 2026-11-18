// Las fechas de evaluación son días ('YYYY-MM-DD'), no instantes. Se manejan
// siempre como fecha local: pasarlas por new Date('2026-11-24') las lee en UTC
// y en Chile aparecen un día antes.

const dosDigitos = (n) => String(n).padStart(2, '0');

export const aTexto = (d) =>
  `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`;

export const desdeTexto = (s) => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const hoy = () => aTexto(new Date());

// Días enteros entre hoy y la fecha (0 = hoy, 1 = mañana).
export function diasHasta(s) {
  const ahora = new Date();
  const base = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  return Math.round((desdeTexto(s) - base) / 86_400_000);
}

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// "lun 24 nov". Sin Intl a propósito: en Android no siempre trae el locale es-CL.
export function corta(s) {
  if (!s) return 'Sin fecha';
  const d = desdeTexto(s);
  return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`;
}

export function relativa(s) {
  const n = diasHasta(s);
  if (n === 0) return 'Hoy';
  if (n === 1) return 'Mañana';
  return `En ${n} días`;
}

// Semanas de lunes a domingo, como se piensa el calendario en la universidad.
export function agrupar(evaluaciones, ahora = new Date()) {
  const diaSemana = (ahora.getDay() + 6) % 7; // 0 = lunes
  const finEstaSemana = 6 - diaSemana;
  const grupos = [
    { title: 'Esta semana', data: [] },
    { title: 'Próxima semana', data: [] },
    { title: 'Más adelante', data: [] },
  ];
  for (const ev of evaluaciones) {
    const n = diasHasta(ev.due_date);
    if (n <= finEstaSemana) grupos[0].data.push(ev);
    else if (n <= finEstaSemana + 7) grupos[1].data.push(ev);
    else grupos[2].data.push(ev);
  }
  return grupos.filter((g) => g.data.length > 0);
}

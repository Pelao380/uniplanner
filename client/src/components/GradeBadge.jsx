export default function GradeBadge({ value }) {
  if (value === null || value === undefined) return <span className="badge muted">—</span>;
  const cls = value >= 4 ? 'ok' : 'bad';
  return <span className={`badge ${cls}`}>{Number(value).toFixed(1)}</span>;
}

export const STATUS_LABEL = {
  'sin-notas': 'Sin notas',
  'en-curso': 'En curso',
  asegurado: 'Aprobación asegurada',
  imposible: 'Ya no alcanza',
  aprobado: 'Aprobado',
  reprobado: 'Reprobado',
};

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { db } from '../store.js';
import { useAuth } from '../AuthContext.jsx';
import GradeBadge, { STATUS_LABEL } from '../components/GradeBadge.jsx';

const EMPTY = { name: '', weight: '', grade: '', due_date: '' };

const toPayload = (f) => ({
  name: f.name,
  weight: Number(f.weight),
  grade: f.grade === '' ? null : Number(f.grade),
  due_date: f.due_date || null,
});

// Qué mostrar en "necesitas en lo que falta". La decisión de si alcanza o no
// la toma el backend (summary.status); acá solo se presenta.
function neededLabel(summary) {
  if (summary.status === 'imposible') return 'Ya no alcanza 😬';
  if (summary.status === 'asegurado') return 'Ya aprobaste 🎉';
  if (summary.neededToPass === null) return '—';
  return summary.neededToPass.toFixed(1);
}

export default function CourseDetail() {
  const { id } = useParams();
  const { esInvitado } = useAuth();
  const [course, setCourse] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  const load = () => db.getCourse(id).then(setCourse).catch((e) => setError(e.message));

  // Depende de esInvitado, no solo del id: al cerrar sesión el ramo ya no sale
  // del mismo lado. Sin esto la página seguía mostrando el ramo de la cuenta
  // anterior hasta que navegaras a otra parte, que en un computador compartido
  // es justo lo que no debe pasar. Se limpia antes de pedir, para no dejar
  // datos viejos en pantalla si la nueva carga falla.
  useEffect(() => {
    setCourse(null);
    setError('');
    setEditingId(null);
    setForm(EMPTY);
    load();
  }, [id, esInvitado]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editingId) await db.updateEvaluation(id, editingId, toPayload(form));
      else await db.createEvaluation(id, toPayload(form));
      setForm(EMPTY);
      setEditingId(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const startEdit = (ev) => {
    setEditingId(ev.id);
    setForm({
      name: ev.name,
      weight: ev.weight,
      grade: ev.grade ?? '',
      due_date: ev.due_date ? ev.due_date.slice(0, 10) : '',
    });
  };

  const onDelete = async (evalId) => {
    if (!confirm('¿Eliminar esta evaluación?')) return;
    setError('');
    try {
      await db.deleteEvaluation(id, evalId);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (error && !course) return <p className="error" role="alert">{error}</p>;
  if (!course) return <p>Cargando…</p>;

  const { summary } = course;
  const faltaPorDeclarar = course.evaluations.length > 0 && summary.totalWeight < 100;

  return (
    <>
      <Link to="/" className="back">← Volver</Link>
      <div className="page-head">
        <div>
          <h2>{course.name}</h2>
          {course.semester && <p className="muted">{course.semester}</p>}
        </div>
      </div>

      <div className="stats">
        <div className="card stat"><span className="muted small">Promedio actual</span><GradeBadge value={summary.currentAverage} /></div>
        <div className="card stat"><span className="muted small">Evaluado</span><strong>{summary.gradedWeight}% de 100%</strong></div>
        <div className="card stat">
          <span className="muted small">Necesitas en lo que falta</span>
          <strong>{neededLabel(summary)}</strong>
        </div>
        <div className="card stat"><span className="muted small">Estado</span><span className={`status ${summary.status}`}>{STATUS_LABEL[summary.status]}</span></div>
      </div>

      {faltaPorDeclarar && (
        <p className="warning">
          ⚠️ Las ponderaciones suman {summary.totalWeight}%. Faltan {Math.round((100 - summary.totalWeight) * 100) / 100}% por declarar,
          así que el promedio se calcula sobre lo que hay.
        </p>
      )}

      <form className="card form-grid" onSubmit={onSubmit}>
        <label>Evaluación*<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Certamen 1" required /></label>
        <label>Ponderación (%)*<input type="number" min="0.01" max="100" step="0.01" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} required /></label>
        <label>Nota (1.0–7.0)<input type="number" min="1" max="7" step="0.1" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} /></label>
        <label>Fecha<input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></label>
        <div className="row">
          <button className="btn">{editingId ? 'Actualizar' : 'Agregar'}</button>
          {editingId && <button type="button" className="btn ghost" onClick={() => { setEditingId(null); setForm(EMPTY); }}>Cancelar</button>}
        </div>
      </form>
      {error && <p className="error" role="alert">{error}</p>}

      <div className="card">
        {course.evaluations.length === 0 ? <p className="muted">Sin evaluaciones todavía.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Evaluación</th><th>Fecha</th><th>Ponderación</th><th>Nota</th><th></th></tr></thead>
              <tbody>
                {course.evaluations.map((ev) => (
                  <tr key={ev.id}>
                    <td>{ev.name}</td>
                    <td>{ev.due_date ? new Date(ev.due_date).toLocaleDateString('es-CL', { timeZone: 'UTC' }) : '—'}</td>
                    <td>{ev.weight}%</td>
                    <td><GradeBadge value={ev.grade} /></td>
                    <td className="actions">
                      <button className="btn ghost small" onClick={() => startEdit(ev)}>Editar</button>
                      <button className="btn ghost small" onClick={() => onDelete(ev.id)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

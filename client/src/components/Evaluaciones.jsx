// El resumen de notas y el alta/edición/borrado de evaluaciones.
//
// Lo usan las dos pantallas que existen: la de un ramo (con cuenta) y la
// calculadora (sin cuenta). Es literalmente la misma pantalla; lo único que
// cambia es de dónde sale el ramo, así que vive acá una sola vez.
//
// `idDelRamo` es una función asíncrona y no un número porque la calculadora no
// tiene ramo hasta que agregas la primera evaluación: recién ahí lo crea.
// Pedírselo al padre deja a este componente sin saber cuál de los dos casos
// está atendiendo. `guardarExamen` existe por lo mismo: cada pantalla sabe
// cómo persistir su propio ramo.
import { useState } from 'react';
import { db } from '../store.js';
import { MIN_GRADE } from '../grades.js';
import GradeBadge, { STATUS_LABEL } from './GradeBadge.jsx';

const EMPTY = { name: '', weight: '', grade: '', due_date: '' };

const toPayload = (f) => ({
  name: f.name,
  weight: Number(f.weight),
  grade: f.grade === '' ? null : Number(f.grade),
  due_date: f.due_date || null,
});

// Qué mostrar en "necesitas en lo que falta". La decisión de si alcanza o no
// la toma el cálculo compartido (summary.status); acá solo se presenta.
function neededLabel(summary) {
  if (summary.status === 'imposible') return 'Ya no alcanza 😬';
  if (summary.status === 'asegurado') return 'Ya aprobaste 🎉';
  if (summary.neededToPass === null) return '—';
  return summary.neededToPass.toFixed(1);
}

function eximicionLabel(summary) {
  if (summary.exempt) return '¡Te eximes! 🎉';
  if (summary.neededForExemption === null) return 'Ya no alcanza';
  return summary.neededForExemption.toFixed(1);
}

function examenLabel(summary) {
  if (summary.exempt) return 'No lo rindes 🎉';
  if (summary.neededInExam === null) return summary.status === 'imposible' ? 'Ya no alcanza 😬' : '—';
  if (summary.neededInExam <= MIN_GRADE) return 'Apruebas igual 🎉';
  return summary.neededInExam.toFixed(1);
}

export default function Evaluaciones({ course, idDelRamo, guardarExamen, onCambio }) {
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  const [examen, setExamen] = useState({
    exemption_grade: course.exemption_grade ?? '',
    exam_weight: course.exam_weight ?? '',
  });
  const [guardandoExamen, setGuardandoExamen] = useState(false);
  const [errorExamen, setErrorExamen] = useState('');

  const { summary, evaluations } = course;
  const faltaPorDeclarar = evaluations.length > 0 && summary.totalWeight < 100;
  const hayExamen = summary.examWeight != null;
  const hayEximicion = hayExamen && summary.exemptionGrade != null;

  const onSubmitExamen = async (e) => {
    e.preventDefault();
    setErrorExamen('');
    setGuardandoExamen(true);
    try {
      await guardarExamen({
        exam_weight: examen.exam_weight === '' ? null : Number(examen.exam_weight),
        exemption_grade: examen.exemption_grade === '' ? null : Number(examen.exemption_grade),
      });
      await onCambio();
    } catch (err) {
      setErrorExamen(err.message);
    } finally {
      setGuardandoExamen(false);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const id = await idDelRamo();
      if (editingId) await db.updateEvaluation(id, editingId, toPayload(form));
      else await db.createEvaluation(id, toPayload(form));
      setForm(EMPTY);
      setEditingId(null);
      await onCambio();
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
      await db.deleteEvaluation(course.id, evalId);
      await onCambio();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      {/* Van arriba porque cambian el significado de todo lo de abajo: con
          examen, el 100% de las evaluaciones deja de ser el ramo y pasa a ser
          la nota de presentación. Vacíos = el ramo no tiene examen. */}
      <form className="card examen-config" onSubmit={onSubmitExamen}>
        <div className="form-grid">
          <label>Se eximen con
            <input type="number" min="1" max="7" step="0.1" placeholder="5.0"
              value={examen.exemption_grade}
              onChange={(e) => setExamen({ ...examen, exemption_grade: e.target.value })} />
          </label>
          <label>El examen vale (%)
            <input type="number" min="0.01" max="99.99" step="0.01" placeholder="30"
              value={examen.exam_weight}
              onChange={(e) => setExamen({ ...examen, exam_weight: e.target.value })} />
          </label>
          <button className="btn ghost" disabled={guardandoExamen}>
            {guardandoExamen ? 'Guardando…' : 'Aplicar'}
          </button>
        </div>
        <p className="muted small">
          {hayExamen
            ? `Tus evaluaciones son la nota de presentación y valen el ${Math.round((100 - summary.examWeight) * 100) / 100}% del ramo.`
            : 'Si el ramo no tiene examen, déjalos vacíos: se calcula solo con tus evaluaciones.'}
        </p>
        {errorExamen && <p className="error" role="alert">{errorExamen}</p>}
      </form>

      <div className="stats">
        <div className="card stat">
          <span className="muted small">{hayExamen ? 'Nota de presentación' : 'Promedio actual'}</span>
          <GradeBadge value={summary.currentAverage} />
        </div>
        <div className="card stat"><span className="muted small">Evaluado</span><strong>{summary.gradedWeight}% de 100%</strong></div>

        {!hayExamen && (
          <div className="card stat">
            <span className="muted small">Necesitas en lo que falta</span>
            <strong>{neededLabel(summary)}</strong>
          </div>
        )}
        {hayEximicion && (
          <div className="card stat">
            <span className="muted small">Para eximirte necesitas</span>
            <strong>{eximicionLabel(summary)}</strong>
          </div>
        )}
        {hayExamen && (
          <div className="card stat">
            <span className="muted small">En el examen necesitas</span>
            <strong>{examenLabel(summary)}</strong>
          </div>
        )}

        <div className="card stat"><span className="muted small">Estado</span><span className={`status ${summary.status}`}>{STATUS_LABEL[summary.status]}</span></div>
      </div>

      {hayExamen && summary.neededInExamIsProvisional && summary.currentAverage !== null && (
        <p className="muted small aviso-provisional">
          Provisional: todavía te faltan evaluaciones por rendir, así que tu presentación
          —y con ella la nota del examen— va a cambiar.
        </p>
      )}

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
        {evaluations.length === 0 ? <p className="muted">Sin evaluaciones todavía.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Evaluación</th><th>Fecha</th><th>Ponderación</th><th>Nota</th><th></th></tr></thead>
              <tbody>
                {evaluations.map((ev) => (
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

// La lista de ramos. Solo existe con sesión: sin cuenta el ruteo muestra la
// calculadora en su lugar.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../store.js';
import { useAuth } from '../AuthContext.jsx';
import GradeBadge, { STATUS_LABEL } from '../components/GradeBadge.jsx';
import GuardarDeInvitado from '../components/GuardarDeInvitado.jsx';

const EMPTY = { name: '', semester: '' };

export default function Dashboard() {
  const { aviso, descartarAviso } = useAuth();
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () =>
    db.listCourses().then(setCourses).catch((e) => setError(e.message)).finally(() => setLoading(false));

  // Basta cargar al montar: al cerrar sesión esta pantalla desaparece completa,
  // así que no hay forma de que quede mostrando los ramos de la cuenta anterior.
  useEffect(() => { load(); }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await db.createCourse(form);
      setForm(EMPTY);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const onDelete = async (id) => {
    if (!confirm('¿Eliminar este ramo y todas sus evaluaciones?')) return;
    setError('');
    try {
      await db.deleteCourse(id);
      setCourses((cs) => cs.filter((c) => c.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  const averages = courses.map((c) => c.summary.currentAverage).filter((a) => a !== null);
  const overall = averages.length ? averages.reduce((a, b) => a + b, 0) / averages.length : null;

  return (
    <>
      {aviso && (
        <p className="nota" role="status">
          {aviso} <button className="link" onClick={descartarAviso}>Entendido</button>
        </p>
      )}

      {/* Si quedaron notas sueltas en el navegador, acá se ofrece guardarlas. */}
      <GuardarDeInvitado onGuardado={load} />

      <div className="page-head">
        <div>
          <h2>Mis ramos</h2>
          <p className="muted">
            {courses.length === 1 ? '1 ramo' : `${courses.length} ramos`} · Promedio general: <GradeBadge value={overall} />
          </p>
        </div>
        <button className="btn" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Cancelar' : '+ Nuevo ramo'}
        </button>
      </div>

      {showForm && (
        <form className="card form-grid" onSubmit={onSubmit}>
          <label>Nombre*<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
          <label>Semestre<input value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })} placeholder="2026-2" /></label>
          <button className="btn">Guardar</button>
        </form>
      )}

      {error && <p className="error" role="alert">{error}</p>}
      {loading ? <p>Cargando…</p> : courses.length === 0 ? (
        <div className="card empty">Aún no tienes ramos. ¡Agrega el primero!</div>
      ) : (
        <div className="grid">
          {courses.map((c) => (
            <div key={c.id} className="card course-card">
              <div className="course-top">
                <Link to={`/courses/${c.id}`} className="course-name">{c.name}</Link>
                <GradeBadge value={c.summary.currentAverage} />
              </div>
              <p className="muted small">{c.semester || 'Sin semestre'}</p>
              <div className="progress">
                <div style={{ width: `${Math.min(c.summary.gradedWeight, 100)}%` }} />
              </div>
              <div className="course-bottom">
                <span className={`status ${c.summary.status}`}>{STATUS_LABEL[c.summary.status]}</span>
                <button className="btn ghost small" onClick={() => onDelete(c.id)}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import GradeBadge, { STATUS_LABEL } from '../components/GradeBadge.jsx';

const EMPTY = { name: '', code: '', semester: '', professor: '' };

export default function Dashboard() {
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () =>
    api.listCourses().then(setCourses).catch((e) => setError(e.message)).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.createCourse(form);
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
      await api.deleteCourse(id);
      setCourses((cs) => cs.filter((c) => c.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  const averages = courses.map((c) => c.summary.currentAverage).filter((a) => a !== null);
  const overall = averages.length ? averages.reduce((a, b) => a + b, 0) / averages.length : null;

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Mis ramos</h2>
          <p className="muted">
            {courses.length} ramo(s) · Promedio general: <GradeBadge value={overall} />
          </p>
        </div>
        <button className="btn" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Cancelar' : '+ Nuevo ramo'}
        </button>
      </div>

      {showForm && (
        <form className="card form-grid" onSubmit={onSubmit}>
          <label>Nombre*<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
          <label>Código<input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="INF-101" /></label>
          <label>Semestre<input value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })} placeholder="2026-2" /></label>
          <label>Profesor/a<input value={form.professor} onChange={(e) => setForm({ ...form, professor: e.target.value })} /></label>
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
              <p className="muted small">
                {[c.code, c.semester, c.professor].filter(Boolean).join(' · ') || 'Sin detalles'}
              </p>
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

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';

export default function AuthPage({ mode }) {
  const isLogin = mode === 'login';
  const { login, register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (isLogin) await login({ email: form.email, password: form.password });
      else await register(form);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={onSubmit}>
        <h1>🎓 UniPlanner</h1>
        <p className="muted">{isLogin ? 'Inicia sesión para ver tus ramos' : 'Crea tu cuenta'}</p>

        {!isLogin && (
          <label>Nombre
            <input name="name" value={form.name} onChange={onChange} required />
          </label>
        )}
        <label>Email
          <input name="email" type="email" value={form.email} onChange={onChange} required />
        </label>
        <label>Contraseña
          <input name="password" type="password" value={form.password} onChange={onChange}
            minLength={isLogin ? undefined : 8} required />
        </label>

        {error && <p className="error">{error}</p>}
        <button className="btn" disabled={submitting}>
          {submitting ? 'Enviando…' : isLogin ? 'Entrar' : 'Registrarme'}
        </button>

        <p className="muted small">
          {isLogin ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
          <Link to={isLogin ? '/register' : '/login'}>{isLogin ? 'Regístrate' : 'Inicia sesión'}</Link>
        </p>
      </form>
    </div>
  );
}

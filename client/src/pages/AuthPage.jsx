import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';

// "Los 1 ramo(s)" se lee mal. Dos frases completas en vez de una con paréntesis.
const avisoDeInvitado = (isLogin, n) => {
  if (isLogin) {
    return n === 1
      ? 'Tienes un ramo guardado en este navegador. Al entrar te preguntaremos si quieres agregarlo a tu cuenta.'
      : `Tienes ${n} ramos guardados en este navegador. Al entrar te preguntaremos si quieres agregarlos a tu cuenta.`;
  }
  return n === 1
    ? 'El ramo que llevas en este navegador se guardará en tu cuenta.'
    : `Los ${n} ramos que llevas en este navegador se guardarán en tu cuenta.`;
};

export default function AuthPage({ mode }) {
  const isLogin = mode === 'login';
  const { login, register, ramosDeInvitado } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Se lee una sola vez, al abrir la página: después de registrarse ya migró
  // y el contador quedaría en cero mientras todavía se ve el formulario.
  const [pendientes] = useState(() => ramosDeInvitado());

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
        <p className="muted">
          {isLogin ? 'Inicia sesión para ver tus ramos' : 'Crea tu cuenta'}
        </p>

        {pendientes > 0 && <p className="nota">{avisoDeInvitado(isLogin, pendientes)}</p>}

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

        {/* La cuenta es opcional: sirve para no perder los datos y verlos en
            otro dispositivo, no para poder usar la app. */}
        <p className="muted small">
          <Link to="/">Prefiero usar la app sin cuenta →</Link>
        </p>
      </form>
    </div>
  );
}

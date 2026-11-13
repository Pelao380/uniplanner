import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import AvisoDespertando from '../components/AvisoDespertando.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

// Sin cuenta las notas no tienen nombre de ramo todavía, así que el aviso no
// puede hablar de "tu ramo". Si son varios vienen de la versión anterior, donde
// el invitado sí los nombraba.
const avisoDeInvitado = (isLogin, n) => {
  if (n === 1) {
    return isLogin
      ? 'Tienes notas guardadas en este navegador. Al entrar podrás guardarlas en tu cuenta.'
      : 'Las notas que llevas en este navegador podrás guardarlas como tu primer ramo.';
  }
  return `Tienes ${n} ramos guardados en este navegador. Al entrar podrás guardarlos en tu cuenta.`;
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
        <AvisoDespertando esperando={submitting} />
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

        {/* Acá no hay barra superior, así que el selector de tema va dentro
            de la tarjeta: si no, esta pantalla sería la única sin salida. */}
        <ThemeToggle />
      </form>
    </div>
  );
}

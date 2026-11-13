import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';

export default function Layout() {
  const { user, logout } = useAuth();
  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">🎓 UniPlanner</Link>
        <div className="topbar-right">
          {user ? (
            <>
              <span>Hola, {user.name.split(' ')[0]}</span>
              <button className="btn ghost" onClick={logout}>Cerrar sesión</button>
            </>
          ) : (
            <>
              <span className="muted small">Modo invitado</span>
              <Link to="/login" className="btn ghost">Entrar</Link>
              <Link to="/register" className="btn">Crear cuenta</Link>
            </>
          )}
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </>
  );
}

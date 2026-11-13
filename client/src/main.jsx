import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext.jsx';
import Layout from './components/Layout.jsx';
import AuthPage from './pages/AuthPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import CourseDetail from './pages/CourseDetail.jsx';
import AvisoDespertando from './components/AvisoDespertando.jsx';
import './styles.css';

// Quien ya tiene cuenta pasa por acá en cada visita: la app valida el token
// guardado contra la API, y si el servicio estaba dormido eso tarda lo mismo
// que un login. Sin el aviso, la app se queda en "Cargando…" medio minuto.
function Cargando() {
  return (
    <div className="center">
      <p>Cargando…</p>
      <AvisoDespertando esperando />
    </div>
  );
}

// La app no exige cuenta: sin sesión funciona igual, guardando en el navegador.
// Lo único que hay que esperar es a saber si el token guardado sirve, para no
// mostrar los datos de invitado un instante a alguien que sí tiene sesión.
function Sesion({ children }) {
  const { loading } = useAuth();
  if (loading) return <Cargando />;
  return children;
}

// Con sesión iniciada no tiene sentido ver el formulario de login.
function SoloSinSesion({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Cargando />;
  return user ? <Navigate to="/" replace /> : children;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<SoloSinSesion><AuthPage mode="login" /></SoloSinSesion>} />
          <Route path="/register" element={<SoloSinSesion><AuthPage mode="register" /></SoloSinSesion>} />
          <Route element={<Sesion><Layout /></Sesion>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/courses/:id" element={<CourseDetail />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

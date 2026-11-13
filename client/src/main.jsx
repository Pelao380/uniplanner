import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext.jsx';
import Layout from './components/Layout.jsx';
import AuthPage from './pages/AuthPage.jsx';
import Calculadora from './pages/Calculadora.jsx';
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

// La portada no es la misma con cuenta y sin ella. Sin cuenta la app es una
// calculadora de notas y nada más; tener varios ramos organizados es lo que se
// gana al registrarse, y por eso el dashboard aparece recién con sesión.
function Inicio() {
  const { esInvitado } = useAuth();
  return esInvitado ? <Calculadora /> : <Dashboard />;
}

// Sin cuenta no hay ramos que abrir. Importa sobre todo al cerrar sesión
// estando dentro de un ramo: en vez de quedarse en una URL que ya no lleva a
// ninguna parte, vuelve a la calculadora.
function SoloConSesion({ children }) {
  const { esInvitado } = useAuth();
  return esInvitado ? <Navigate to="/" replace /> : children;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<SoloSinSesion><AuthPage mode="login" /></SoloSinSesion>} />
          <Route path="/register" element={<SoloSinSesion><AuthPage mode="register" /></SoloSinSesion>} />
          <Route element={<Sesion><Layout /></Sesion>}>
            <Route path="/" element={<Inicio />} />
            <Route path="/courses/:id" element={<SoloConSesion><CourseDetail /></SoloConSesion>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

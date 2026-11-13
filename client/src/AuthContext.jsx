import { createContext, useContext, useEffect, useState } from 'react';
import { api, tokenStore, setUnauthorizedHandler } from './api.js';
import { invitado } from './local.js';

const AuthContext = createContext(null);

// Sube a la cuenta lo que se calculó en este navegador sin sesión.
// En serie a propósito: cada evaluación necesita el id que el servidor le
// asignó a su ramo. Solo se borra lo local si subió todo; si algo falla a
// medio camino, los datos siguen acá y el usuario no pierde nada.
//
// `nombre` se usa solo cuando hay exactamente un ramo, que es el caso normal:
// sin cuenta la app es una calculadora suelta y el nombre se pregunta recién
// acá. Varios ramos solo pueden venir de la versión anterior, donde el
// invitado los nombró él mismo, y esos conservan su nombre.
async function subirDatosDeInvitado(nombre) {
  const pendientes = invitado.contenido();
  if (pendientes.length === 0) return 0;

  for (const { curso, evaluaciones } of pendientes) {
    const datos = pendientes.length === 1 && nombre ? { ...curso, name: nombre } : curso;
    const creado = await api.createCourse(datos);
    for (const ev of evaluaciones) await api.createEvaluation(creado.id, ev);
  }

  invitado.limpiar();
  return pendientes.length;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aviso, setAviso] = useState('');
  // Cuántos ramos quedaron en el navegador al entrar a la cuenta. Mientras sea
  // mayor que cero, el dashboard ofrece guardarlos.
  const [pendientes, setPendientes] = useState(0);

  // Si el token expira a mitad de uso, la app vuelve sola a modo invitado.
  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    if (!tokenStore.get()) return setLoading(false);
    api.me()
      .then(({ user }) => setUser(user))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  // Se cuenta antes de mostrar nada, porque subirlos borra lo local y después
  // ya no habría qué contar.
  const entrar = ({ user, token }) => {
    tokenStore.set(token);
    setPendientes(invitado.cuantosRamos());
    setUser(user);
  };

  const value = {
    user,
    loading,
    aviso,
    descartarAviso: () => setAviso(''),
    // Sin usuario la app funciona igual, contra el navegador.
    esInvitado: !user,
    ramosDeInvitado: () => invitado.cuantosRamos(),
    pendientes,

    // "Ahora no": deja de ofrecerlo y nada más. No borra lo local, así que la
    // próxima vez que entre lo encuentra igual.
    descartarPendientes: () => setPendientes(0),

    // Subir no es automático ni en login ni en registro: la calculadora de
    // invitado no pide nombre de ramo, así que hay que preguntarlo, y en una
    // cuenta que ya tenía ramos subir sin avisar duplicaría cosas.
    guardarDeInvitado: async (nombre) => {
      try {
        const n = await subirDatosDeInvitado(nombre);
        setPendientes(0);
        setAviso(n === 1
          ? 'Listo: tus notas quedaron guardadas en tu cuenta.'
          : `Listo: se guardaron ${n} ramos en tu cuenta.`);
      } catch (err) {
        // Los pendientes quedan como están, para poder reintentar.
        setAviso(`No se pudieron subir tus notas (${err.message}). Siguen guardadas en este navegador.`);
      }
    },

    register: async (datos) => entrar(await api.register(datos)),
    login: async (datos) => entrar(await api.login(datos)),

    logout: () => {
      tokenStore.clear();
      setUser(null);
      setAviso('');
      setPendientes(0);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

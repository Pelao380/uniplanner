import { createContext, useContext, useEffect, useState } from 'react';
import { api, tokenStore, setUnauthorizedHandler } from './api.js';
import { invitado } from './local.js';

const AuthContext = createContext(null);

// Sube a la cuenta los ramos que el invitado creó en este navegador.
// En serie a propósito: cada evaluación necesita el id que el servidor le
// asignó a su ramo. Solo se borra lo local si subió todo; si algo falla a
// medio camino, los datos siguen acá y el usuario no pierde nada.
async function migrarDatosDeInvitado() {
  const pendientes = invitado.contenido();
  if (pendientes.length === 0) return 0;

  for (const { curso, evaluaciones } of pendientes) {
    const creado = await api.createCourse(curso);
    for (const ev of evaluaciones) await api.createEvaluation(creado.id, ev);
  }

  invitado.limpiar();
  return pendientes.length;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aviso, setAviso] = useState('');

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

  const entrar = async ({ user, token }, migrar) => {
    tokenStore.set(token);
    if (migrar) {
      try {
        const n = await migrarDatosDeInvitado();
        if (n === 1) setAviso('Se guardó en tu cuenta el ramo que tenías en este navegador.');
        else if (n > 1) setAviso(`Se guardaron en tu cuenta los ${n} ramos que tenías en este navegador.`);
      } catch (err) {
        setAviso(`No se pudieron subir tus ramos de invitado (${err.message}). Siguen guardados en este navegador.`);
      }
    }
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

    // Cuenta recién creada: está vacía, así que lo local se sube sin preguntar.
    register: async (datos) => entrar(await api.register(datos), true),

    // Al iniciar sesión la cuenta puede tener ramos de antes. Subir lo local
    // sin avisar duplicaría cosas, así que se pregunta.
    login: async (datos) => {
      const n = invitado.cuantosRamos();
      const migrar = n > 0 && confirm(
        n === 1
          ? 'Tienes un ramo guardado en este navegador. ¿Quieres agregarlo a tu cuenta?'
          : `Tienes ${n} ramos guardados en este navegador. ¿Quieres agregarlos a tu cuenta?`
      );
      return entrar(await api.login(datos), migrar);
    },

    logout: () => {
      tokenStore.clear();
      setUser(null);
      setAviso('');
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

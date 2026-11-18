// La sesión del usuario. En móvil la cuenta es obligatoria: los recordatorios
// y "Futuras evaluaciones" necesitan tus ramos guardados en algún lado.
import { createContext, useContext, useEffect, useState } from 'react';
import { api, setUnauthorizedHandler, tokenStore } from './api.js';
import { olvidar, sincronizar } from './notificaciones.js';

const SesionContext = createContext(null);

export function SesionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [cargando, setCargando] = useState(true);

  // Si el token expira a mitad de uso, la app vuelve sola al login.
  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        if (await tokenStore.get()) setUser((await api.me()).user);
      } catch {
        // Sin conexión o servidor dormido al abrir: se pide el login de nuevo.
        // El token se conserva salvo que el servidor lo haya rechazado (401).
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  const entrar = async ({ user, token }) => {
    await tokenStore.set(token);
    setUser(user);
    sincronizar();
  };

  const value = {
    user,
    cargando,
    login: async (datos) => entrar(await api.login(datos)),
    register: async (datos) => entrar(await api.register(datos)),
    logout: async () => {
      await tokenStore.clear();
      await olvidar();
      setUser(null);
    },
  };

  return <SesionContext.Provider value={value}>{children}</SesionContext.Provider>;
}

export const useSesion = () => useContext(SesionContext);

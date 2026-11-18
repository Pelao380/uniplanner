// El mismo cliente de la web (client/src/api.js), con dos diferencias de móvil:
// el token vive en el almacenamiento cifrado del sistema y no en localStorage,
// y leerlo es asíncrono.
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// En el APK la define eas.json; en desarrollo, mobile/.env.
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api';

const CLAVE_TOKEN = 'uniplanner.token';

// SecureStore no existe en la web (expo start --web se usa solo para probar),
// así que ahí cae a localStorage, como en la app web.
export const tokenStore = Platform.OS === 'web'
  ? {
      get: async () => localStorage.getItem(CLAVE_TOKEN),
      set: async (t) => localStorage.setItem(CLAVE_TOKEN, t),
      clear: async () => localStorage.removeItem(CLAVE_TOKEN),
    }
  : {
      get: () => SecureStore.getItemAsync(CLAVE_TOKEN),
      set: (t) => SecureStore.setItemAsync(CLAVE_TOKEN, t),
      clear: () => SecureStore.deleteItemAsync(CLAVE_TOKEN),
    };

// La sesión registra acá qué hacer cuando el token deja de servir, para que un
// 401 lleve al login en vez de dejar al usuario mirando un error.
let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = await tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.');
  }

  if (res.status === 401 && token) {
    await tokenStore.clear();
    if (onUnauthorized) onUnauthorized();
    throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
  }

  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.details?.map((d) => d.message).join(', ');
    throw new Error(detail || data.error || 'Error de red');
  }
  return data;
}

export const api = {
  register: (data) => request('/auth/register', { method: 'POST', body: data }),
  login: (data) => request('/auth/login', { method: 'POST', body: data }),
  me: () => request('/auth/me'),

  listCourses: () => request('/courses'),
  getCourse: (id) => request(`/courses/${id}`),
  createCourse: (data) => request('/courses', { method: 'POST', body: data }),
  updateCourse: (id, data) => request(`/courses/${id}`, { method: 'PUT', body: data }),
  deleteCourse: (id) => request(`/courses/${id}`, { method: 'DELETE' }),

  createEvaluation: (courseId, data) =>
    request(`/courses/${courseId}/evaluations`, { method: 'POST', body: data }),
  updateEvaluation: (courseId, evalId, data) =>
    request(`/courses/${courseId}/evaluations/${evalId}`, { method: 'PUT', body: data }),
  deleteEvaluation: (courseId, evalId) =>
    request(`/courses/${courseId}/evaluations/${evalId}`, { method: 'DELETE' }),

  // `desde` es el "hoy" del teléfono: ver server/src/routes/evaluations.js.
  upcoming: (desde) => request(`/evaluations/upcoming?desde=${desde}`),
};

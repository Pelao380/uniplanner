const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export const tokenStore = {
  get: () => localStorage.getItem('token'),
  set: (t) => localStorage.setItem('token', t),
  clear: () => localStorage.removeItem('token'),
};

// La app registra acá qué hacer cuando el token deja de servir, para que un
// 401 cierre la sesión en vez de dejar al usuario atascado viendo un error.
let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Teníamos token y el servidor lo rechazó: expiró o es inválido.
  if (res.status === 401 && token) {
    tokenStore.clear();
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
};

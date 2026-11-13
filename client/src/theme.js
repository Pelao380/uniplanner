// Preferencia de tema del usuario.
//
// Tres estados, no dos: "sistema" es el valor por defecto y respeta lo que la
// persona ya configuró en su computador o teléfono. Claro y oscuro son para
// cuando quiere lo contrario de eso en esta app en particular.
//
// Quien aplica el tema antes de pintar es el script inline de index.html.
// Este módulo solo lo cambia después, así que la clave y los valores
// guardados tienen que coincidir con los de ahí.

const CLAVE = 'uniplanner:tema';
const ATRIBUTO = { claro: 'light', oscuro: 'dark' };

export const TEMAS = ['sistema', 'claro', 'oscuro'];

export function leerTema() {
  try {
    const guardado = localStorage.getItem(CLAVE);
    return TEMAS.includes(guardado) ? guardado : 'sistema';
  } catch {
    return 'sistema'; // localStorage bloqueado (incógnito): manda el sistema
  }
}

export function aplicarTema(tema) {
  const raiz = document.documentElement;
  // Sin atributo, el CSS deja decidir a prefers-color-scheme.
  if (tema === 'sistema') raiz.removeAttribute('data-theme');
  else raiz.setAttribute('data-theme', ATRIBUTO[tema]);

  try {
    localStorage.setItem(CLAVE, tema);
  } catch {
    // No se pudo guardar: el tema igual se aplicó, pero se pierde al recargar.
  }
}

export const siguienteTema = (tema) => TEMAS[(TEMAS.indexOf(tema) + 1) % TEMAS.length];

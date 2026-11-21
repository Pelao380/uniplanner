// Aplica el tema guardado antes del primer pintado (lo carga index.html).
// Solo escribe el atributo; los colores los pone styles.css. Sin preferencia
// guardada no hace nada y manda la del sistema operativo.
// La clave y los valores tienen que coincidir con src/theme.js.
try {
  var tema = localStorage.getItem('uniplanner:tema');
  if (tema === 'oscuro') document.documentElement.setAttribute('data-theme', 'dark');
  else if (tema === 'claro') document.documentElement.setAttribute('data-theme', 'light');
} catch (e) {
  /* localStorage bloqueado: se usa el tema del sistema */
}

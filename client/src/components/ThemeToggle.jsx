import { useState } from 'react';
import { leerTema, aplicarTema, siguienteTema } from '../theme.js';

const ICONO = { sistema: '🖥️', claro: '☀️', oscuro: '🌙' };
const NOMBRE = { sistema: 'el del sistema', claro: 'claro', oscuro: 'oscuro' };

export default function ThemeToggle() {
  const [tema, setTema] = useState(leerTema);
  const proximo = siguienteTema(tema);

  const cambiar = () => {
    aplicarTema(proximo);
    setTema(proximo);
  };

  // El emoji solo no dice nada a un lector de pantalla, y tampoco a quien no
  // reconozca el icono: el texto va en aria-label y en el tooltip.
  const descripcion = `Tema ${NOMBRE[tema]}. Cambiar a ${NOMBRE[proximo]}.`;

  return (
    <button type="button" className="tema" onClick={cambiar} title={descripcion} aria-label={descripcion}>
      <span aria-hidden="true">{ICONO[tema]}</span>
    </button>
  );
}

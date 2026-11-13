import { useEffect, useState } from 'react';

// Devuelve true cuando una espera lleva más de `ms` y todavía no termina.
//
// Existe por el plan gratuito de Render: apaga el servicio cuando nadie lo
// usa y la primera petición después tarda entre 20 y 50 segundos en lo que
// levanta el contenedor. Medio minuto con un botón que dice "Enviando…" y
// nada más en pantalla no se lee como una espera, se lee como que la app se
// colgó, y la gente cierra la pestaña.
//
// No acelera nada: solo permite explicar por qué está tardando. El umbral es
// corto a propósito, pero no tanto como para parpadear en una petición normal
// (la API despierta responde en 0,25 s).
export function useEsperaLarga(esperando, ms = 2500) {
  const [esLarga, setEsLarga] = useState(false);

  useEffect(() => {
    if (!esperando) {
      setEsLarga(false);
      return;
    }
    const id = setTimeout(() => setEsLarga(true), ms);
    return () => clearTimeout(id);
  }, [esperando, ms]);

  return esLarga;
}

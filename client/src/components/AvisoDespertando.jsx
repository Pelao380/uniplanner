import { useEsperaLarga } from '../useEsperaLarga.js';

// Aparece solo si la petición se está demorando de verdad. En condiciones
// normales nunca se ve: la API despierta responde en menos de medio segundo.
export default function AvisoDespertando({ esperando }) {
  const mostrar = useEsperaLarga(esperando);
  if (!mostrar) return null;

  return (
    <p className="nota" role="status">
      Despertando el servidor… La primera conexión en un rato puede tardar hasta un minuto,
      porque el plan gratuito apaga el servicio cuando nadie lo usa. No cierres la página.
    </p>
  );
}

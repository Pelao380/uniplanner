// Lo que se le ofrece al entrar a la cuenta cuando quedaron notas guardadas en
// este navegador sin sesión.
//
// Antes esto era un confirm() del navegador al iniciar sesión. Ya no alcanza:
// la calculadora de invitado no pide nombre de ramo, así que hay que
// preguntarlo, y un confirm() no puede pedir texto.
import { useState } from 'react';
import { useAuth } from '../AuthContext.jsx';

const POR_DEFECTO = 'Mis notas';

export default function GuardarDeInvitado({ onGuardado }) {
  const { pendientes, guardarDeInvitado, descartarPendientes } = useAuth();
  const [nombre, setNombre] = useState('');
  const [guardando, setGuardando] = useState(false);

  if (pendientes === 0) return null;

  const guardar = async (comoSeLlama) => {
    setGuardando(true);
    try {
      await guardarDeInvitado(comoSeLlama);
      // El ramo nuevo ya está en la cuenta, pero la lista de la pantalla se
      // cargó antes de que existiera.
      await onGuardado?.();
    } finally {
      setGuardando(false);
    }
  };

  // Varios ramos solo puede venir de la versión anterior, donde el invitado los
  // nombró él mismo: no hay nada que preguntar.
  if (pendientes > 1) {
    return (
      <div className="nota">
        <p>Tienes {pendientes} ramos guardados en este navegador, sin cuenta.</p>
        <div className="row">
          <button className="btn" disabled={guardando} onClick={() => guardar()}>
            {guardando ? 'Guardando…' : 'Guardarlos en mi cuenta'}
          </button>
          <button className="btn ghost" disabled={guardando} onClick={descartarPendientes}>Ahora no</button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="nota"
      onSubmit={(e) => { e.preventDefault(); guardar(nombre.trim() || POR_DEFECTO); }}
    >
      <p>Tienes notas guardadas en este navegador, sin cuenta. ¿Cómo se llama ese ramo?</p>
      <div className="row">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder={POR_DEFECTO}
          maxLength={150}
          aria-label="Nombre del ramo"
        />
        <button className="btn" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        <button type="button" className="btn ghost" disabled={guardando} onClick={descartarPendientes}>Ahora no</button>
      </div>
    </form>
  );
}

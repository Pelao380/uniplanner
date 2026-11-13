// La app sin cuenta: una calculadora de notas y nada más.
//
// Sin sesión no existe el concepto de ramo. Entras tus evaluaciones y ves el
// promedio al tiro, sin pasar antes por un formulario de "nombre del ramo"
// que no le sirve a quien solo quiere saber con cuánto queda. Tener varios
// ramos a la vez es lo que se gana al crear una cuenta.
//
// Por dentro sí hay un ramo (el almacenamiento local es el mismo que usa la
// API), pero es implícito y se crea recién con la primera evaluación.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../store.js';
import { summarize } from '../grades.js';
import Evaluaciones from '../components/Evaluaciones.jsx';

const NOMBRE_IMPLICITO = 'Mis notas';

export default function Calculadora() {
  const [ramo, setRamo] = useState(null);
  const [deAntes, setDeAntes] = useState(0);
  const [error, setError] = useState('');

  const cargar = async () => {
    const lista = await db.listCourses();
    // Más de uno solo puede venir de la versión anterior, cuando el invitado
    // podía crear ramos. La calculadora trabaja sobre el primero y avisa que
    // los otros están ahí, en vez de esconderlos y parecer que se perdieron.
    setDeAntes(Math.max(lista.length - 1, 0));
    setRamo(lista.length === 0
      ? { id: null, evaluations: [], summary: summarize([]) }
      : await db.getCourse(lista[0].id));
  };

  useEffect(() => { cargar().catch((e) => setError(e.message)); }, []);

  // El ramo no se crea al abrir la página, sino cuando hay algo que guardar.
  // Entrar a mirar no debería escribir en el navegador: si está bloqueado,
  // el error aparece cuando el usuario de verdad intentó guardar algo.
  const idDelRamo = async () => {
    if (ramo?.id) return ramo.id;
    const creado = await db.createCourse({ name: NOMBRE_IMPLICITO });
    return creado.id;
  };

  if (error && !ramo) return <p className="error" role="alert">{error}</p>;
  if (!ramo) return <p>Cargando…</p>;

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Calculadora de notas</h2>
          <p className="muted">Agrega tus evaluaciones y mira con cuánto quedas.</p>
        </div>
      </div>

      <Evaluaciones course={ramo} idDelRamo={idDelRamo} onCambio={cargar} />

      <p className="nota">
        Esto se guarda <strong>solo en este navegador</strong>.{' '}
        <Link to="/register">Crea una cuenta</Link> para llevar varios ramos a la vez,
        no perderlos y abrirlos desde otro dispositivo.
      </p>

      {deAntes > 0 && (
        <p className="nota">
          Además tienes {deAntes === 1 ? 'otro ramo guardado' : `otros ${deAntes} ramos guardados`}{' '}
          en este navegador, de antes. <Link to="/register">Crea una cuenta</Link> y se guardan todos.
        </p>
      )}
    </>
  );
}

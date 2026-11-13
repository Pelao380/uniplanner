import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { db } from '../store.js';
import { useAuth } from '../AuthContext.jsx';
import Evaluaciones from '../components/Evaluaciones.jsx';

export default function CourseDetail() {
  const { id } = useParams();
  const { esInvitado } = useAuth();
  const [course, setCourse] = useState(null);
  const [error, setError] = useState('');

  const load = () => db.getCourse(id).then(setCourse).catch((e) => setError(e.message));

  // Depende de esInvitado, no solo del id: al cerrar sesión el ramo ya no sale
  // del mismo lado. Sin esto la página seguía mostrando el ramo de la cuenta
  // anterior hasta que navegaras a otra parte, que en un computador compartido
  // es justo lo que no debe pasar. Se limpia antes de pedir, para no dejar
  // datos viejos en pantalla si la nueva carga falla.
  useEffect(() => {
    setCourse(null);
    setError('');
    load();
  }, [id, esInvitado]);

  if (error && !course) return <p className="error" role="alert">{error}</p>;
  if (!course) return <p>Cargando…</p>;

  return (
    <>
      <Link to="/" className="back">← Volver</Link>
      <div className="page-head">
        <div>
          <h2>{course.name}</h2>
          {course.semester && <p className="muted">{course.semester}</p>}
        </div>
      </div>

      {/* El ramo ya existe, así que el id está a mano desde el principio.
          La key reinicia el formulario al cambiar de ramo: una evaluación a
          medio editar no corresponde al ramo siguiente. */}
      <Evaluaciones
        key={`${id}-${esInvitado}`}
        course={course}
        idDelRamo={async () => id}
        onCambio={load}
      />
    </>
  );
}

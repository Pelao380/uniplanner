// Un ramo: examen, resumen de notas y sus evaluaciones. Es la versión móvil de
// client/src/components/Evaluaciones.jsx, con los mismos textos y reglas.
import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { api } from '../../../api.js';
import { MIN_GRADE, summarize } from '../../../grades.js';
import { corta } from '../../../fechas.js';
import { sincronizar } from '../../../notificaciones.js';
import { STATUS_LABEL, useTema } from '../../../tema.js';
import CampoFecha from '../../../components/CampoFecha.jsx';
import {
  AvisoDespertando, Boton, Campo, confirmar, Error, Nota, NotaBadge, Tarjeta, Texto, useAccion,
} from '../../../components/ui.jsx';

const VACIO = { name: '', weight: '', grade: '', due_date: '' };

// Los teclados en español escriben coma decimal: "5,5" tiene que valer 5.5.
const numero = (v) => Number(String(v).replace(',', '.'));
const aPayload = (f) => ({
  name: f.name,
  weight: numero(f.weight),
  grade: f.grade === '' ? null : numero(f.grade),
  due_date: f.due_date || null,
});

function necesitasLabel(r) {
  if (r.status === 'imposible') return 'Ya no alcanza 😬';
  if (r.status === 'asegurado') return 'Ya aprobaste 🎉';
  if (r.neededToPass === null) return '—';
  return r.neededToPass.toFixed(1);
}

function eximicionLabel(r) {
  if (r.exempt) return '¡Te eximes! 🎉';
  if (r.neededForExemption === null) return 'Ya no alcanza';
  return r.neededForExemption.toFixed(1);
}

function examenLabel(r) {
  if (r.exempt) return 'No lo rindes 🎉';
  if (r.neededInExam === null) return r.status === 'imposible' ? 'Ya no alcanza 😬' : '—';
  if (r.neededInExam <= MIN_GRADE) return 'Apruebas igual 🎉';
  return r.neededInExam.toFixed(1);
}

function Dato({ etiqueta, children }) {
  return (
    <Tarjeta style={s.dato}>
      <Texto chico suave>{etiqueta}</Texto>
      {typeof children === 'string' ? <Texto negrita>{children}</Texto> : children}
    </Tarjeta>
  );
}

export default function Ramo() {
  const { id } = useLocalSearchParams();
  const t = useTema();
  const [ramo, setRamo] = useState(null);
  const [examen, setExamen] = useState({ exemption_grade: '', exam_weight: '' });
  const [form, setForm] = useState(VACIO);
  const [editando, setEditando] = useState(null);
  const carga = useAccion();
  const guardarExamen = useAccion();
  const guardarEval = useAccion();

  const cargar = useCallback(() => carga.correr(async () => {
    const r = await api.getCourse(id);
    setRamo(r);
    return r;
  }), [id]);

  useEffect(() => {
    cargar().then((r) => r && setExamen({
      exemption_grade: r.exemption_grade == null ? '' : String(r.exemption_grade),
      exam_weight: r.exam_weight == null ? '' : String(r.exam_weight),
    }));
  }, [cargar]);

  // Cualquier cambio en las evaluaciones puede mover un recordatorio.
  const trasCambio = async () => {
    await cargar();
    sincronizar();
  };

  const aplicarExamen = () => guardarExamen.correr(async () => {
    await api.updateCourse(id, {
      name: ramo.name,
      semester: ramo.semester,
      exam_weight: examen.exam_weight === '' ? null : numero(examen.exam_weight),
      exemption_grade: examen.exemption_grade === '' ? null : numero(examen.exemption_grade),
    });
    await cargar();
  });

  const guardar = () => guardarEval.correr(async () => {
    if (editando) await api.updateEvaluation(id, editando, aPayload(form));
    else await api.createEvaluation(id, aPayload(form));
    setForm(VACIO);
    setEditando(null);
    await trasCambio();
  });

  const editar = (ev) => {
    setEditando(ev.id);
    guardarEval.setError('');
    setForm({
      name: ev.name,
      weight: String(ev.weight),
      grade: ev.grade == null ? '' : String(ev.grade),
      due_date: ev.due_date ?? '',
    });
  };

  const eliminar = async (ev) => {
    if (!(await confirmar('Eliminar evaluación', `¿Eliminar "${ev.name}"?`))) return;
    guardarEval.correr(async () => {
      await api.deleteEvaluation(id, ev.id);
      if (editando === ev.id) { setEditando(null); setForm(VACIO); }
      await trasCambio();
    });
  };

  if (!ramo) {
    return (
      <View style={s.contenido}>
        <AvisoDespertando esperando={carga.cargando} />
        {carga.error ? <Error>{carga.error}</Error> : <Texto suave>Cargando…</Texto>}
      </View>
    );
  }

  // El resumen se calcula acá mismo con la copia de grades.js, igual que lo
  // haría el servidor (el CI lo garantiza).
  const r = summarize(ramo.evaluations, { examWeight: ramo.exam_weight, exemptionGrade: ramo.exemption_grade });
  const hayExamen = r.examWeight != null;
  const hayEximicion = hayExamen && r.exemptionGrade != null;
  const faltaPorDeclarar = ramo.evaluations.length > 0 && r.totalWeight < 100;

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: ramo.name }} />
      <ScrollView contentContainerStyle={s.contenido} keyboardShouldPersistTaps="handled">
        {ramo.semester ? <Texto suave>{ramo.semester}</Texto> : null}

        <View style={s.grilla}>
          <Dato etiqueta={hayExamen ? 'Nota de presentación' : 'Promedio actual'}>
            <NotaBadge value={r.currentAverage} grande />
          </Dato>
          <Dato etiqueta="Evaluado">{`${r.gradedWeight}% de 100%`}</Dato>
          {!hayExamen && <Dato etiqueta="Necesitas en lo que falta">{necesitasLabel(r)}</Dato>}
          {hayEximicion && <Dato etiqueta="Para eximirte necesitas">{eximicionLabel(r)}</Dato>}
          {hayExamen && <Dato etiqueta="En el examen necesitas">{examenLabel(r)}</Dato>}
          <Dato etiqueta="Estado">{STATUS_LABEL[r.status]}</Dato>
        </View>

        {hayExamen && r.neededInExamIsProvisional && r.currentAverage !== null && (
          <Texto chico suave>
            Provisional: todavía te faltan evaluaciones por rendir, así que tu presentación
            —y con ella la nota del examen— va a cambiar.
          </Texto>
        )}
        {faltaPorDeclarar && (
          <Nota>
            ⚠️ Las ponderaciones suman {r.totalWeight}%. Faltan {Math.round((100 - r.totalWeight) * 100) / 100}% por
            declarar, así que el promedio se calcula sobre lo que hay.
          </Nota>
        )}

        <Texto negrita style={s.titulo}>Evaluaciones</Texto>
        {ramo.evaluations.length === 0 ? (
          <Texto suave>Sin evaluaciones todavía.</Texto>
        ) : ramo.evaluations.map((ev) => (
          <Tarjeta key={ev.id} style={editando === ev.id && { borderColor: t.primario }}>
            <View style={s.fila}>
              <View style={s.flex}>
                <Texto negrita>{ev.name}</Texto>
                <Texto chico suave>{corta(ev.due_date)} · {ev.weight}%</Texto>
              </View>
              <NotaBadge value={ev.grade} />
            </View>
            <View style={s.fila}>
              <Pressable accessibilityRole="button" onPress={() => editar(ev)} style={s.enlace}>
                <Texto style={{ color: t.primario }}>Editar</Texto>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => eliminar(ev)} style={s.enlace}>
                <Texto style={{ color: t.mal }}>Eliminar</Texto>
              </Pressable>
            </View>
          </Tarjeta>
        ))}

        <Tarjeta>
          <Texto negrita>{editando ? 'Editar evaluación' : 'Agregar evaluación'}</Texto>
          <Campo etiqueta="Evaluación*" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })}
            placeholder="Certamen 1" />
          <View style={s.fila}>
            <Campo style={s.flex} etiqueta="Ponderación (%)*" value={form.weight}
              onChangeText={(v) => setForm({ ...form, weight: v })} keyboardType="decimal-pad" placeholder="30" />
            <Campo style={s.flex} etiqueta="Nota (1.0–7.0)" value={form.grade}
              onChangeText={(v) => setForm({ ...form, grade: v })} keyboardType="decimal-pad" placeholder="Pendiente" />
          </View>
          <CampoFecha valor={form.due_date} onCambio={(v) => setForm({ ...form, due_date: v })} />
          <Error>{guardarEval.error}</Error>
          <AvisoDespertando esperando={guardarEval.cargando} />
          <View style={s.fila}>
            {editando && (
              <Boton titulo="Cancelar" fantasma style={s.flex}
                onPress={() => { setEditando(null); setForm(VACIO); guardarEval.setError(''); }} />
            )}
            <Boton titulo={editando ? 'Actualizar' : 'Agregar'} style={s.flex} onPress={guardar}
              cargando={guardarEval.cargando} />
          </View>
        </Tarjeta>

        {/* Al final y no arriba como en la web: en el teléfono se configura una
            vez por semestre, y las notas son lo que se mira todos los días. */}
        <Tarjeta>
          <Texto negrita>Examen</Texto>
          <View style={s.fila}>
            <Campo style={s.flex} etiqueta="Se eximen con" value={examen.exemption_grade}
              onChangeText={(v) => setExamen({ ...examen, exemption_grade: v })} keyboardType="decimal-pad" placeholder="5.0" />
            <Campo style={s.flex} etiqueta="El examen vale (%)" value={examen.exam_weight}
              onChangeText={(v) => setExamen({ ...examen, exam_weight: v })} keyboardType="decimal-pad" placeholder="30" />
          </View>
          <Texto chico suave>
            {hayExamen
              ? `Tus evaluaciones son la nota de presentación y valen el ${Math.round((100 - r.examWeight) * 100) / 100}% del ramo.`
              : 'Si el ramo no tiene examen, déjalos vacíos: se calcula solo con tus evaluaciones.'}
          </Texto>
          <Error>{guardarExamen.error}</Error>
          <Boton titulo="Aplicar" fantasma onPress={aplicarExamen} cargando={guardarExamen.cargando} />
        </Tarjeta>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  contenido: { padding: 16, gap: 12, paddingBottom: 40 },
  grilla: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  dato: { flexGrow: 1, flexBasis: '45%', gap: 6, padding: 12 },
  titulo: { fontSize: 18, marginTop: 8 },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  enlace: { paddingVertical: 6, paddingHorizontal: 4 },
});

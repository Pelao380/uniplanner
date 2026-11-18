import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { api } from '../../../api.js';
import { STATUS_LABEL, useTema } from '../../../tema.js';
import {
  AvisoDespertando, Boton, Campo, confirmar, Error, NotaBadge, Tarjeta, Texto, useAccion,
} from '../../../components/ui.jsx';

const VACIO = { name: '', semester: '' };

export default function Ramos() {
  const t = useTema();
  const [ramos, setRamos] = useState(null);
  const [form, setForm] = useState(VACIO);
  const [creando, setCreando] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const carga = useAccion();
  const guardar = useAccion();

  const cargar = useCallback(() => carga.correr(async () => setRamos(await api.listCourses())), []);

  // Se recarga cada vez que vuelves a esta pestaña: lo que cambiaste dentro de
  // un ramo (notas, examen) cambia su promedio acá.
  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const refrescar = async () => {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  };

  const crear = () => guardar.correr(async () => {
    const ramo = await api.createCourse(form);
    setForm(VACIO);
    setCreando(false);
    router.push(`/ramo/${ramo.id}`);
  });

  const eliminar = async (ramo) => {
    if (!(await confirmar('Eliminar ramo', `¿Eliminar "${ramo.name}" y todas sus evaluaciones?`))) return;
    carga.correr(async () => {
      await api.deleteCourse(ramo.id);
      setRamos((rs) => rs.filter((r) => r.id !== ramo.id));
    });
  };

  const promedios = (ramos ?? []).map((r) => r.summary.currentAverage).filter((a) => a !== null);
  const general = promedios.length ? promedios.reduce((a, b) => a + b, 0) / promedios.length : null;

  const cabecera = (
    <View style={s.cabecera}>
      <View style={s.fila}>
        <Texto suave>
          {ramos ? `${ramos.length === 1 ? '1 ramo' : `${ramos.length} ramos`} · Promedio general` : 'Cargando…'}
        </Texto>
        <NotaBadge value={general} />
      </View>

      <AvisoDespertando esperando={carga.cargando && !ramos} />
      <Error>{carga.error}</Error>

      {creando ? (
        <Tarjeta>
          <Campo etiqueta="Nombre del ramo*" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })}
            placeholder="Cálculo I" autoFocus />
          <Campo etiqueta="Semestre" value={form.semester} onChangeText={(v) => setForm({ ...form, semester: v })}
            placeholder="2026-2" />
          <Error>{guardar.error}</Error>
          <View style={s.fila}>
            <Boton titulo="Cancelar" fantasma style={s.flex} onPress={() => { setCreando(false); guardar.setError(''); }} />
            <Boton titulo="Guardar" style={s.flex} onPress={crear} cargando={guardar.cargando} />
          </View>
        </Tarjeta>
      ) : (
        <Boton titulo="+ Nuevo ramo" onPress={() => setCreando(true)} />
      )}
    </View>
  );

  return (
    <FlatList
      data={ramos ?? []}
      keyExtractor={(r) => String(r.id)}
      contentContainerStyle={s.lista}
      ListHeaderComponent={cabecera}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} colors={[t.primario]} />}
      ListEmptyComponent={ramos && (
        <Tarjeta><Texto suave style={s.centrado}>Aún no tienes ramos. ¡Agrega el primero!</Texto></Tarjeta>
      )}
      renderItem={({ item: r }) => (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(`/ramo/${r.id}`)}
          onLongPress={() => eliminar(r)}
        >
          <Tarjeta>
            <View style={s.fila}>
              <View style={s.flex}>
                <Texto negrita numberOfLines={1}>{r.name}</Texto>
                <Texto chico suave>{r.semester || 'Sin semestre'}</Texto>
              </View>
              <NotaBadge value={r.summary.currentAverage} />
            </View>
            <View style={[s.barra, { backgroundColor: t.borde }]}>
              <View style={[s.relleno, { width: `${Math.min(r.summary.gradedWeight, 100)}%`, backgroundColor: t.primario }]} />
            </View>
            <View style={s.fila}>
              <Texto chico suave>{STATUS_LABEL[r.summary.status]}</Texto>
              <Texto chico suave>{r.summary.gradedWeight}% evaluado</Texto>
            </View>
          </Tarjeta>
        </Pressable>
      )}
      ListFooterComponent={ramos?.length ? (
        <Texto chico suave style={s.centrado}>Mantén presionado un ramo para eliminarlo.</Texto>
      ) : null}
    />
  );
}

const s = StyleSheet.create({
  lista: { padding: 16, gap: 12 },
  cabecera: { gap: 12, marginBottom: 4 },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  flex: { flex: 1 },
  centrado: { textAlign: 'center' },
  barra: { height: 6, borderRadius: 3, overflow: 'hidden' },
  relleno: { height: 6 },
});

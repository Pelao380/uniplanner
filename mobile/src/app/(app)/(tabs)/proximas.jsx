// Futuras evaluaciones: todo lo que viene, de todos los ramos, agrupado por cercanía.
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { api } from '../../../api.js';
import { agrupar, corta, diasHasta, hoy, relativa } from '../../../fechas.js';
import { reprogramar } from '../../../notificaciones.js';
import { useTema } from '../../../tema.js';
import { AvisoDespertando, Error, NotaBadge, Tarjeta, Texto, useAccion } from '../../../components/ui.jsx';

export default function Proximas() {
  const t = useTema();
  const [evaluaciones, setEvaluaciones] = useState(null);
  const [refrescando, setRefrescando] = useState(false);
  const carga = useAccion();

  const cargar = useCallback(() => carga.correr(async () => {
    const lista = await api.upcoming(hoy());
    setEvaluaciones(lista);
    // Ya que se bajó la lista, se aprovecha de dejar los avisos al día.
    reprogramar(lista).catch(() => {});
  }), []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const refrescar = async () => {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  };

  const urgente = (ev) => diasHasta(ev.due_date) <= 1 && ev.grade == null;

  return (
    <SectionList
      sections={agrupar(evaluaciones ?? [])}
      keyExtractor={(ev) => String(ev.id)}
      contentContainerStyle={s.lista}
      stickySectionHeadersEnabled={false}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} colors={[t.primario]} />}
      ListHeaderComponent={(
        <View style={s.cabecera}>
          <AvisoDespertando esperando={carga.cargando && !evaluaciones} />
          <Error>{carga.error}</Error>
          {!evaluaciones && !carga.error && <Texto suave>Cargando…</Texto>}
        </View>
      )}
      ListEmptyComponent={evaluaciones && (
        <Tarjeta>
          <Texto style={s.centrado}>No tienes evaluaciones próximas 🎉</Texto>
          <Texto chico suave style={s.centrado}>
            Aparecen acá las evaluaciones que tengan fecha de hoy en adelante. Agrégales fecha desde cada ramo.
          </Texto>
        </Tarjeta>
      )}
      renderSectionHeader={({ section }) => (
        <Texto negrita style={s.seccion}>{section.title}</Texto>
      )}
      renderItem={({ item: ev }) => (
        <Pressable accessibilityRole="button" onPress={() => router.push(`/ramo/${ev.course_id}`)}>
          <Tarjeta style={urgente(ev) && { borderColor: t.mal }}>
            <View style={s.fila}>
              <View style={s.fecha}>
                <Texto chico negrita style={{ color: urgente(ev) ? t.mal : t.primario }}>{relativa(ev.due_date)}</Texto>
                <Texto chico suave>{corta(ev.due_date)}</Texto>
              </View>
              <View style={s.flex}>
                <Texto negrita numberOfLines={1}>{ev.name}</Texto>
                <Texto chico suave numberOfLines={1}>{ev.course_name} · {ev.weight}%</Texto>
              </View>
              {ev.grade != null && <NotaBadge value={ev.grade} />}
            </View>
          </Tarjeta>
        </Pressable>
      )}
    />
  );
}

const s = StyleSheet.create({
  lista: { padding: 16, gap: 10 },
  cabecera: { gap: 10 },
  seccion: { fontSize: 18, marginTop: 8 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fecha: { width: 82 },
  flex: { flex: 1 },
  centrado: { textAlign: 'center' },
});

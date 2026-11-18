// Fecha de una evaluación ('YYYY-MM-DD' o ''), con el selector nativo de Android.
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useTema } from '../tema.js';
import { aTexto, corta, desdeTexto } from '../fechas.js';
import { Campo, Texto } from './ui.jsx';

export default function CampoFecha({ etiqueta = 'Fecha', valor, onCambio }) {
  const t = useTema();
  const [abiertoIos, setAbiertoIos] = useState(false);

  // En la web (solo desarrollo) no hay selector nativo: se escribe a mano.
  if (Platform.OS === 'web') {
    return (
      <Campo etiqueta={`${etiqueta} (AAAA-MM-DD)`} value={valor} onChangeText={onCambio}
        placeholder="2026-11-24" inputMode="numeric" />
    );
  }

  const fecha = valor ? desdeTexto(valor) : new Date();
  const elegir = (_evento, d) => {
    setAbiertoIos(false);
    if (d) onCambio(aTexto(d));
  };

  const abrir = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: fecha, mode: 'date', onChange: (e, d) => e.type === 'set' && elegir(e, d) });
    } else {
      setAbiertoIos(true);
    }
  };

  return (
    <View style={s.campo}>
      <Texto chico suave>{etiqueta}</Texto>
      <View style={s.fila}>
        <Pressable accessibilityRole="button" onPress={abrir}
          style={[s.caja, { borderColor: t.borde, backgroundColor: t.fondo }]}>
          <Texto suave={!valor}>{valor ? corta(valor) : 'Sin fecha'}</Texto>
        </Pressable>
        {valor ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Quitar fecha" onPress={() => onCambio('')} style={s.quitar}>
            <Texto suave>✕</Texto>
          </Pressable>
        ) : null}
      </View>
      {abiertoIos && <DateTimePicker value={fecha} mode="date" display="inline" onChange={elegir} />}
    </View>
  );
}

const s = StyleSheet.create({
  campo: { gap: 4 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  caja: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12 },
  quitar: { padding: 10 },
});

// Piezas de interfaz que se repiten en todas las pantallas.
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTema } from '../tema.js';
import { useEsperaLarga } from '../useEsperaLarga.js';

export function Tarjeta({ style, children }) {
  const t = useTema();
  return (
    <View style={[s.tarjeta, { backgroundColor: t.tarjeta, borderColor: t.borde }, style]}>
      {children}
    </View>
  );
}

export function Texto({ suave, chico, negrita, style, children, ...props }) {
  const t = useTema();
  return (
    <Text
      style={[
        { color: suave ? t.suave : t.texto, fontSize: chico ? 13 : 16 },
        negrita && { fontWeight: '700' },
        style,
      ]}
      {...props}
    >
      {children}
    </Text>
  );
}

export function Boton({ titulo, onPress, cargando, fantasma, peligro, disabled, style }) {
  const t = useTema();
  const color = peligro ? t.mal : t.primario;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || cargando}
      style={({ pressed }) => [
        s.boton,
        fantasma
          ? { borderColor: color, borderWidth: 1 }
          : { backgroundColor: color },
        (pressed || disabled || cargando) && { opacity: 0.6 },
        style,
      ]}
    >
      {cargando
        ? <ActivityIndicator color={fantasma ? color : t.sobrePrimario} />
        : <Text style={[s.botonTexto, { color: fantasma ? color : t.sobrePrimario }]}>{titulo}</Text>}
    </Pressable>
  );
}

export function Campo({ etiqueta, style, ...props }) {
  const t = useTema();
  return (
    <View style={[s.campo, style]}>
      <Texto chico suave>{etiqueta}</Texto>
      <TextInput
        placeholderTextColor={t.suave}
        style={[s.input, { color: t.texto, borderColor: t.borde, backgroundColor: t.fondo }]}
        {...props}
      />
    </View>
  );
}

export function Error({ children }) {
  const t = useTema();
  if (!children) return null;
  return (
    <Text accessibilityRole="alert" style={[s.mensaje, { color: t.mal, backgroundColor: t.malFondo }]}>
      {children}
    </Text>
  );
}

export function Nota({ children }) {
  const t = useTema();
  return <Text style={[s.mensaje, { color: t.aviso, backgroundColor: t.avisoFondo }]}>{children}</Text>;
}

// Solo aparece si la petición se demora de verdad: ver useEsperaLarga.js.
export function AvisoDespertando({ esperando }) {
  if (!useEsperaLarga(esperando)) return null;
  return (
    <Nota>
      Despertando el servidor… La primera conexión en un rato puede tardar hasta un minuto,
      porque el plan gratuito apaga el servicio cuando nadie lo usa.
    </Nota>
  );
}

export function NotaBadge({ value, grande }) {
  const t = useTema();
  const hay = value !== null && value !== undefined;
  const ok = hay && value >= 4;
  return (
    <Text
      style={[
        s.badge,
        grande && s.badgeGrande,
        hay
          ? { color: ok ? t.ok : t.mal, backgroundColor: ok ? t.okFondo : t.malFondo }
          : { color: t.suave, backgroundColor: t.fondo },
      ]}
    >
      {hay ? Number(value).toFixed(1) : '—'}
    </Text>
  );
}

// Alert.alert no muestra botones en la web; ahí se usa el confirm del navegador.
export function confirmar(titulo, mensaje, accion = 'Eliminar') {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${titulo}\n\n${mensaje}`));
  return new Promise((resolve) => {
    Alert.alert(titulo, mensaje, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: accion, style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

// Para botones que hacen una petición: maneja el "cargando" y el error.
export function useAccion() {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const correr = async (fn) => {
    setError('');
    setCargando(true);
    try {
      return await fn();
    } catch (e) {
      setError(e.message);
      return undefined;
    } finally {
      setCargando(false);
    }
  };
  return { cargando, error, setError, correr };
}

const s = StyleSheet.create({
  tarjeta: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 10 },
  boton: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', minHeight: 46 },
  botonTexto: { fontSize: 16, fontWeight: '600' },
  campo: { gap: 4 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  mensaje: { borderRadius: 10, padding: 12, fontSize: 14, overflow: 'hidden' },
  badge: { fontWeight: '700', fontSize: 15, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, overflow: 'hidden', minWidth: 44, textAlign: 'center' },
  badgeGrande: { fontSize: 22, paddingVertical: 6 },
});

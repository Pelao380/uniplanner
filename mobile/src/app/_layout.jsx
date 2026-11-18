import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { SesionProvider, useSesion } from '../sesion.jsx';
import { useTema } from '../tema.js';
import { AvisoDespertando, Texto } from '../components/ui.jsx';

function Navegacion() {
  const { user, cargando } = useSesion();
  const t = useTema();

  // Mientras se revisa el token guardado. Con la API dormida puede tardar,
  // y por eso el aviso.
  if (cargando) {
    return (
      <View style={[s.centro, { backgroundColor: t.fondo }]}>
        <Texto negrita style={s.logo}>🎓 UniPlanner</Texto>
        <ActivityIndicator color={t.primario} />
        <AvisoDespertando esperando />
      </View>
    );
  }

  // Stack.Protected: sin sesión no se puede llegar a (app), y al cerrar sesión
  // su historial se borra entero (no se puede volver con "atrás").
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.fondo } }}>
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SesionProvider>
      <StatusBar style="auto" />
      <Navegacion />
    </SesionProvider>
  );
}

const s = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  logo: { fontSize: 28 },
});

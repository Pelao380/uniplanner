import { useEffect } from 'react';
import { AppState } from 'react-native';
import { Stack } from 'expo-router';
import { useTema } from '../../tema.js';
import { sincronizar } from '../../notificaciones.js';
import { ofrecerActualizacion } from '../../actualizacion.js';

export default function AppLayout() {
  const t = useTema();

  // Los recordatorios se rehacen al abrir la app y cada vez que vuelve al
  // frente: así recoge lo que hayas cambiado desde la web.
  useEffect(() => {
    ofrecerActualizacion();
    sincronizar();
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') sincronizar();
    });
    return () => sub.remove();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: t.tarjeta },
        headerTintColor: t.texto,
        contentStyle: { backgroundColor: t.fondo },
      }}
    >
      {/* El título es lo que lee el botón "atrás" (y un lector de pantalla). */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Ramos' }} />
      <Stack.Screen name="ramo/[id]" options={{ title: 'Ramo' }} />
    </Stack>
  );
}

import { Text } from 'react-native';
import { Tabs } from 'expo-router/tabs';
import { useTema } from '../../../tema.js';

const icono = (emoji) => ({ focused }) => (
  <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
);

export default function TabsLayout() {
  const t = useTema();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: t.tarjeta },
        headerTintColor: t.texto,
        tabBarStyle: { backgroundColor: t.tarjeta, borderTopColor: t.borde },
        tabBarActiveTintColor: t.primario,
        tabBarInactiveTintColor: t.suave,
        sceneStyle: { backgroundColor: t.fondo },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Mis ramos', tabBarLabel: 'Ramos', tabBarIcon: icono('📚') }} />
      <Tabs.Screen name="proximas" options={{ title: 'Futuras evaluaciones', tabBarLabel: 'Próximas', tabBarIcon: icono('📅') }} />
      <Tabs.Screen name="cuenta" options={{ title: 'Cuenta', tabBarIcon: icono('👤') }} />
    </Tabs>
  );
}

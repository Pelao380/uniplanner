import { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSesion } from '../../../sesion.jsx';
import { activar, desactivar, disponibles, estanActivos, HORA_AVISO } from '../../../notificaciones.js';
import { useTema } from '../../../tema.js';
import { Boton, confirmar, Error, Tarjeta, Texto } from '../../../components/ui.jsx';

export default function Cuenta() {
  const t = useTema();
  const { user, logout } = useSesion();
  const [activos, setActivos] = useState(false);
  const [sinPermiso, setSinPermiso] = useState(false);

  useEffect(() => { estanActivos().then(setActivos); }, []);

  const cambiar = async (quiere) => {
    setSinPermiso(false);
    if (!quiere) {
      await desactivar();
      setActivos(false);
      return;
    }
    const ok = await activar();
    setActivos(ok);
    setSinPermiso(!ok);
  };

  const salir = async () => {
    if (await confirmar('Cerrar sesión', 'Los recordatorios de esta cuenta dejarán de llegar a este teléfono.', 'Cerrar sesión')) {
      logout();
    }
  };

  return (
    <ScrollView contentContainerStyle={s.contenido}>
      <Tarjeta>
        <Texto negrita>{user.name}</Texto>
        <Texto suave>{user.email}</Texto>
      </Tarjeta>

      <Tarjeta>
        <View style={s.fila}>
          <View style={s.flex}>
            <Texto negrita>Recordatorios</Texto>
            <Texto chico suave>
              Te avisamos la víspera de cada evaluación, a las {HORA_AVISO}:00. Llegan aunque no tengas internet.
            </Texto>
          </View>
          <Switch
            value={activos}
            onValueChange={cambiar}
            disabled={!disponibles}
            trackColor={{ true: t.primario }}
            accessibilityLabel="Recordatorios"
          />
        </View>
        {!disponibles && <Texto chico suave>Los recordatorios solo funcionan en la app instalada.</Texto>}
        {sinPermiso && (
          <>
            <Error>Android no dio permiso para mostrar notificaciones.</Error>
            <Boton titulo="Abrir ajustes del teléfono" fantasma onPress={() => Linking.openSettings()} />
          </>
        )}
        {activos && (
          <Texto chico suave>
            Si no te llegan, revisa que el ahorro de batería no esté limitando a UniPlanner.
          </Texto>
        )}
      </Tarjeta>

      <Boton titulo="Cerrar sesión" peligro fantasma onPress={salir} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  contenido: { padding: 16, gap: 12 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
});

import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Linking, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSesion } from '../../../sesion.jsx';
import {
  activar, agendados, alarmasExactas, desactivar, disponibles, estanActivos, HORA_AVISO, probar,
} from '../../../notificaciones.js';
import { aTexto, corta } from '../../../fechas.js';
import { abrirInicioAutomatico, esXiaomi, pedirExcepcion, restringida } from '../../../bateria.js';
import { buscarNueva, descargar, versionActual } from '../../../actualizacion.js';
import { useTema } from '../../../tema.js';
import { Boton, confirmar, Error, Nota, Tarjeta, Texto } from '../../../components/ui.jsx';

export default function Cuenta() {
  const t = useTema();
  const { user, logout } = useSesion();
  const [activos, setActivos] = useState(false);
  const [sinPermiso, setSinPermiso] = useState(false);
  const [estado, setEstado] = useState(null); // { cantidad, proximo, exactas, bateria }
  const [probando, setProbando] = useState(false);
  const [nueva, setNueva] = useState(null);

  // Lo agendado cambia al editar evaluaciones en otras pantallas: se relee al volver.
  const revisar = useCallback(async () => {
    const on = await estanActivos();
    setActivos(on);
    if (!on) return setEstado(null);
    const [lista, exactas, bateria] = await Promise.all([agendados(), alarmasExactas(), restringida()]);
    setEstado({ ...lista, exactas, bateria });
  }, []);
  useFocusEffect(useCallback(() => {
    revisar();
    buscarNueva().then(setNueva);
  }, [revisar]));

  const prueba = async () => {
    await probar();
    setProbando(true);
  };

  const cambiar = async (quiere) => {
    setSinPermiso(false);
    if (!quiere) {
      await desactivar();
      setActivos(false);
      return;
    }
    const ok = await activar();
    setSinPermiso(!ok);
    // Se pide de inmediato, en el mismo gesto de activar: es cuando se entiende para qué es.
    if (ok && await restringida()) await pedirExcepcion();
    await revisar();
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
        {activos && estado && (
          <>
            <Texto chico suave>
              {estado.cantidad === 0
                ? 'No hay avisos pendientes: solo se agendan evaluaciones con fecha desde mañana y sin nota.'
                : `${estado.cantidad} ${estado.cantidad === 1 ? 'aviso agendado' : 'avisos agendados'}. `
                  + (estado.proximo ? `El próximo: ${corta(aTexto(estado.proximo))}, ${HORA_AVISO}:00.` : '')}
            </Texto>
            {!estado.exactas && (
              <Nota>
                Android no permite alarmas exactas a UniPlanner, así que los avisos pueden atrasarse.
                Actívalo en Ajustes › Apps › UniPlanner › Alarmas y recordatorios.
              </Nota>
            )}
            {estado.bateria && (
              <>
                <Nota>
                  El ahorro de batería puede bloquear los avisos. Permitir que UniPlanner funcione en
                  segundo plano no gasta más batería: la app no hace nada mientras está cerrada.
                </Nota>
                <Boton
                  titulo="Permitir en segundo plano"
                  fantasma
                  onPress={async () => { await pedirExcepcion(); await revisar(); }}
                />
              </>
            )}
            {esXiaomi && (
              <>
                <Texto chico suave>
                  En Xiaomi activa también el "Inicio automático" de UniPlanner, o MIUI puede borrar
                  los avisos agendados.
                </Texto>
                <Boton titulo="Abrir Inicio automático" fantasma onPress={abrirInicioAutomatico} />
              </>
            )}
            <Boton titulo="Probar: avisar en 1 minuto" fantasma onPress={prueba} />
            {probando && (
              <Texto chico suave>
                Listo. Bloquea el teléfono y espera: si en un par de minutos no llega, el ahorro
                de batería está frenando a UniPlanner (Ajustes › Batería › Sin restricciones).
              </Texto>
            )}
          </>
        )}
      </Tarjeta>

      {nueva && (
        <Tarjeta>
          <Texto negrita>Hay una versión nueva: {nueva}</Texto>
          <Texto chico suave>Se instala encima de la actual, sin perder nada.</Texto>
          <Boton titulo="Descargar" onPress={descargar} />
        </Tarjeta>
      )}

      <Boton titulo="Cerrar sesión" peligro fantasma onPress={salir} />
      <Texto chico suave style={s.version}>UniPlanner {versionActual}</Texto>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  contenido: { padding: 16, gap: 12 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  version: { textAlign: 'center' },
});

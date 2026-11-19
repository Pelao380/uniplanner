// Recordatorios de evaluaciones, 100% locales.
//
// No hay push desde el servidor: la API duerme en el plan gratuito y no podría
// despertar a la hora de avisar. En cambio, cada vez que la app tiene la lista
// de evaluaciones futuras se la entrega a Android, que avisa a la hora exacta
// aunque la app esté cerrada, el teléfono sin internet o la API dormida.
//
// Reprogramar siempre parte de cero (cancela todo y vuelve a agendar): así una
// evaluación borrada o cambiada de fecha nunca deja un aviso huérfano.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api.js';
import { desdeTexto, hoy } from './fechas.js';

const CANAL = 'evaluaciones';
const CLAVE_ACTIVOS = 'uniplanner.recordatorios';
const PRUEBA = 'prueba';

// El aviso sale la víspera a esta hora: tiempo para repasar, no para entrar en pánico.
export const HORA_AVISO = 20;

// La web (solo para desarrollo) no agenda notificaciones locales.
export const disponibles = Platform.OS !== 'web';

if (disponibles) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function estanActivos() {
  if (!disponibles) return false;
  return (await AsyncStorage.getItem(CLAVE_ACTIVOS)) === '1';
}

// Crear un canal que ya existe no hace nada, así que se llama cada vez que se
// agenda: un aviso dirigido a un canal inexistente Android lo descarta en silencio.
const asegurarCanal = () =>
  Notifications.setNotificationChannelAsync(CANAL, {
    name: 'Evaluaciones',
    importance: Notifications.AndroidImportance.HIGH,
  });

// Sin alarmas exactas (Android 12+), Android trata el aviso como "más o menos a
// esa hora" y con el teléfono en reposo lo puede atrasar horas. La app declara
// USE_EXACT_ALARM, que se concede al instalar; esto revisa que así haya sido.
export async function alarmasExactas() {
  if (Platform.OS !== 'android') return true;
  try {
    return (await Notifications.getExactAlarmPermissionsAsync()).granted;
  } catch {
    return true; // versiones de Android sin este permiso
  }
}

// Pide el permiso (Android 13+ lo exige). Devuelve si quedaron activos.
export async function activar() {
  if (!disponibles) return false;
  // En Android el diálogo de permiso no aparece si no existe un canal.
  await asegurarCanal();

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== 'granted') return false;

  await AsyncStorage.setItem(CLAVE_ACTIVOS, '1');
  await sincronizar();
  return true;
}

export async function desactivar() {
  if (!disponibles) return;
  await AsyncStorage.setItem(CLAVE_ACTIVOS, '0');
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// Al cerrar sesión los avisos de esa cuenta no pueden seguir saliendo.
export async function olvidar() {
  if (!disponibles) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// Cuándo avisar una evaluación: la víspera a las HORA_AVISO.
export function momentoDelAviso(dueDate) {
  const d = desdeTexto(dueDate);
  d.setDate(d.getDate() - 1);
  d.setHours(HORA_AVISO, 0, 0, 0);
  return d;
}

// Solo las que todavía no tienen nota: la que ya está corregida no hay que rendirla.
export function avisosPara(evaluaciones, ahora = new Date()) {
  return evaluaciones
    .filter((e) => e.due_date && (e.grade === null || e.grade === undefined))
    .map((e) => ({ ev: e, cuando: momentoDelAviso(e.due_date) }))
    .filter(({ cuando }) => cuando > ahora);
}

export async function reprogramar(evaluaciones) {
  if (!(await estanActivos())) return 0;
  await asegurarCanal();
  // Todo menos el aviso de prueba: volver a la app durante ese minuto lo borraría.
  for (const n of await Notifications.getAllScheduledNotificationsAsync()) {
    if (n.identifier !== PRUEBA) await Notifications.cancelScheduledNotificationAsync(n.identifier);
  }

  const avisos = avisosPara(evaluaciones);
  for (const { ev, cuando } of avisos) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Mañana: ${ev.name}`,
        body: `${ev.course_name} · vale ${ev.weight}%`,
        data: { courseId: ev.course_id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: cuando,
        channelId: CANAL,
      },
    });
  }
  return avisos.length;
}

// Para ver en el teléfono qué quedó agendado: cuántos avisos y el más próximo.
export async function agendados() {
  if (!disponibles) return { cantidad: 0, proximo: null };
  const lista = (await Notifications.getAllScheduledNotificationsAsync())
    .filter((n) => n.identifier !== PRUEBA);
  const fechas = lista
    .map((n) => n.trigger?.value ?? n.trigger?.date)
    .filter((v) => v !== undefined && v !== null)
    .map((v) => new Date(v))
    .sort((a, b) => a - b);
  return { cantidad: lista.length, proximo: fechas[0] ?? null };
}

// Un aviso de prueba en un minuto: alcanza para bloquear el teléfono y ver
// si llega con la app cerrada.
export async function probar() {
  await asegurarCanal();
  await Notifications.scheduleNotificationAsync({
    identifier: PRUEBA,
    content: { title: 'Aviso de prueba', body: 'Si ves esto, los recordatorios funcionan.' },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(Date.now() + 60_000),
      channelId: CANAL,
    },
  });
}

// Baja las evaluaciones futuras y reprograma. Si la API no responde (dormida o
// sin internet) no pasa nada: quedan agendados los avisos de la vez anterior.
export async function sincronizar() {
  if (!(await estanActivos())) return;
  try {
    await reprogramar(await api.upcoming(hoy()));
  } catch {
    // Silencioso a propósito: es una tarea de fondo, no algo que pidió el usuario.
  }
}

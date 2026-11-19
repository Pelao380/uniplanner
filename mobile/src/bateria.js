// El ahorro de batería es lo que más frena los recordatorios en Android.
//
// La app no corre nada en segundo plano: solo deja horas agendadas en el
// sistema. Pero varios fabricantes (Xiaomi sobre todo) cancelan esas horas a
// las apps que no están "sin restricciones". Pedir la excepción es un diálogo
// del sistema de un toque y no aumenta el consumo: no hay trabajo de fondo que
// pueda gastar más.
import { Platform } from 'react-native';
import * as Battery from 'expo-battery';
import * as IntentLauncher from 'expo-intent-launcher';
import Constants from 'expo-constants';

const esAndroid = Platform.OS === 'android';
const paquete = Constants.expoConfig?.android?.package ?? 'com.uniplanner.app';

// Xiaomi, Redmi y POCO tienen además su propio "Inicio automático", aparte del
// ahorro de batería de Android, y ninguna app puede consultar si está activo.
export const esXiaomi =
  esAndroid && /xiaomi|redmi|poco/i.test(`${Platform.constants?.Manufacturer} ${Platform.constants?.Brand}`);

// true si Android la está restringiendo (el caso por defecto).
export async function restringida() {
  if (!esAndroid) return false;
  try {
    return await Battery.isBatteryOptimizationEnabledAsync();
  } catch {
    return false;
  }
}

// Muestra el diálogo "¿Permitir que funcione en segundo plano?". Resuelve al
// volver a la app, con o sin respuesta: hay que volver a preguntar con restringida().
export async function pedirExcepcion() {
  if (!esAndroid) return;
  try {
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
      { data: `package:${paquete}` },
    );
  } catch {
    // Algunas capas de fabricante no traen el diálogo: la lista general sirve igual.
    await abrir(IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
  }
}

// La pantalla de "Inicio automático" de MIUI/HyperOS. Su ruta no es pública y
// cambia entre versiones; si no existe, se abre la ficha de la app en Ajustes.
export async function abrirInicioAutomatico() {
  try {
    await IntentLauncher.startActivityAsync('android.intent.action.MAIN', {
      packageName: 'com.miui.securitycenter',
      className: 'com.miui.permcenter.autostart.AutoStartManagementActivity',
    });
  } catch {
    await abrir(IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS, `package:${paquete}`);
  }
}

async function abrir(accion, data) {
  try {
    await IntentLauncher.startActivityAsync(accion, data ? { data } : undefined);
  } catch {
    // Sin pantalla a la que ir no hay nada más que hacer.
  }
}

// Aviso de versión nueva.
//
// La app no está en Google Play, así que nadie le avisa al teléfono que hay una
// versión nueva. Al abrirla se pregunta a GitHub cuál es el último Release y,
// si es más nuevo que el instalado, se ofrece descargarlo. El APK de cada
// Release se llama siempre UniPlanner.apk, así que el link no cambia.
import { Alert, Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import Constants from 'expo-constants';

const REPO = 'Pelao380/uniplanner';
export const LINK_DESCARGA = `https://github.com/${REPO}/releases/latest/download/UniPlanner.apk`;
const CLAVE_DESCARTADA = 'uniplanner.version-descartada';

// La que Android dice que está instalada: es la que importa para comparar. La de
// app.json (expoConfig) es solo el respaldo de la web, donde no hay APK.
export const versionActual =
  Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '0.0.0';

// En la web (solo desarrollo) no hay APK que instalar.
const disponible = Platform.OS === 'android';

// '1.0.10' > '1.0.9': se compara número por número, no como texto.
export function esMasNueva(candidata, actual) {
  const a = candidata.split('.').map(Number);
  const b = actual.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return false;
}

// No se usa api.github.com: sin token permite 60 consultas por hora por IP, y en
// datos móviles muchos teléfonos salen por la misma IP. La página
// /releases/latest, en cambio, redirige a /releases/tag/v1.0.4 sin ese límite:
// basta un HEAD y leer a dónde terminó.
let consulta = null; // una por apertura de la app basta

// La versión nueva ('1.0.4') o null si no hay, no se pudo saber o no aplica.
export function buscarNueva() {
  if (!disponible) return Promise.resolve(null);
  consulta ??= fetch(`https://github.com/${REPO}/releases/latest`, { method: 'HEAD' })
    .then((r) => {
      const ultima = r.ok ? r.url.match(/\/releases\/tag\/v?([\d.]+)$/)?.[1] : null;
      return ultima && esMasNueva(ultima, versionActual) ? ultima : null;
    })
    .catch(() => {
      consulta = null; // sin internet: se reintenta la próxima vez
      return null;
    });
  return consulta;
}

export const descargar = () => Linking.openURL(LINK_DESCARGA);

// Al abrir la app. "Ahora no" no vuelve a preguntar por esa misma versión
// (sigue disponible en Cuenta), pero sí cuando salga la siguiente.
export async function ofrecerActualizacion() {
  const nueva = await buscarNueva();
  if (!nueva || (await AsyncStorage.getItem(CLAVE_DESCARTADA)) === nueva) return;
  Alert.alert(
    'Hay una versión nueva',
    `UniPlanner ${nueva} está disponible (tienes la ${versionActual}). Se instala encima, sin perder nada.`,
    [
      { text: 'Ahora no', style: 'cancel', onPress: () => AsyncStorage.setItem(CLAVE_DESCARTADA, nueva) },
      { text: 'Descargar', onPress: descargar },
    ],
  );
}

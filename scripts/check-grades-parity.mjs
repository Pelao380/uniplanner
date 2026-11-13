// El cálculo de notas existe dos veces: en el servidor y en el cliente, porque
// el modo invitado trabaja sin API. Este script exige que las dos copias den
// exactamente el mismo resultado. Corre en CI; si alguien edita una sola, falla.
//
//   node scripts/check-grades-parity.mjs

import * as servidor from '../server/src/grades.js';
import * as cliente from '../client/src/grades.js';

let fallas = 0;
const falla = (msg) => { console.error('✗ ' + msg); fallas += 1; };

// --- Las constantes del dominio tienen que coincidir ---
for (const k of ['MIN_GRADE', 'MAX_GRADE', 'PASSING_GRADE', 'ROUNDS_FINAL_GRADE']) {
  if (servidor[k] !== cliente[k]) falla(`${k}: servidor ${servidor[k]} vs cliente ${cliente[k]}`);
}

// --- Generador con semilla fija: una falla se puede reproducir ---
let semilla = 12345;
const rnd = () => {
  semilla = (semilla * 1664525 + 1013904223) % 4294967296;
  return semilla / 4294967296;
};
const entre = (a, b) => a + rnd() * (b - a);
const nota = () => Math.round(entre(1, 7) * 10) / 10;

function casoAlAzar() {
  const n = Math.floor(rnd() * 7); // 0 a 6 evaluaciones
  const evs = [];
  let restante = 100;
  for (let i = 0; i < n; i += 1) {
    // A veces las ponderaciones suman menos de 100 y a veces justo 100.
    const w = i === n - 1 && rnd() < 0.4
      ? Math.round(restante * 100) / 100
      : Math.round(entre(0.01, Math.max(restante, 0.01)) * 100) / 100;
    if (w <= 0) break;
    restante = Math.round((restante - w) * 100) / 100;
    // Un tercio de las evaluaciones queda sin nota (pendiente).
    evs.push({ weight: w, grade: rnd() < 0.33 ? null : nota() });
  }
  return evs;
}

// --- Casos de borde escritos a mano, además de los aleatorios ---
const bordes = [
  [],
  [{ weight: 100, grade: null }],
  [{ weight: 100, grade: 4.0 }],
  [{ weight: 100, grade: 3.9 }],
  [{ weight: 100, grade: 1.0 }],
  [{ weight: 100, grade: 7.0 }],
  [{ weight: 30, grade: 3.5 }, { weight: 30, grade: 5.0 }, { weight: 40, grade: null }],
  [{ weight: 50, grade: 1.0 }, { weight: 50, grade: null }],   // imposible
  [{ weight: 50, grade: 7.0 }, { weight: 50, grade: null }],   // asegurado
  [{ weight: 0.01, grade: 7.0 }],
  [{ weight: 99.99, grade: 4.0 }],
  [{ weight: 60, grade: 3.95 }, { weight: 40, grade: 3.95 }],  // el límite del redondeo
];

const casos = [...bordes];
for (let i = 0; i < 20000; i += 1) casos.push(casoAlAzar());

for (const [i, evs] of casos.entries()) {
  const a = JSON.stringify(servidor.summarize(evs));
  const b = JSON.stringify(cliente.summarize(evs));
  if (a !== b) {
    falla(`caso ${i} ${JSON.stringify(evs)}\n    servidor: ${a}\n    cliente:  ${b}`);
    if (fallas > 5) break;
  }
}

if (fallas) {
  console.error(`\n${fallas} diferencia(s) entre server/src/grades.js y client/src/grades.js.`);
  process.exit(1);
}
console.log(`✓ ${casos.length} casos: el servidor y el cliente calculan igual.`);

// Genera los íconos de UniPlanner: un calendario con un check, sobre índigo.
// Uso: npm run iconos (reescribe los PNG de assets/). Editar acá, no los PNG.
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2];
const INDIGO = '#4F46E5';
const OSCURO = '#312E81';
const CLARO = '#C7D2FE';

// Glifo dibujado en una caja de 1024 y escalado por `escala` alrededor del centro.
function glifo(escala, { mono = false } = {}) {
  const t = `translate(512 512) scale(${escala}) translate(-512 -512)`;
  if (mono) {
    // Monocromo: solo cuenta la forma (Android la tiñe). Check y anillos recortados.
    return `
      <defs><mask id="m">
        <rect width="1024" height="1024" fill="white"/>
        <polyline points="372,600 470,692 660,500" fill="none" stroke="black" stroke-width="76" stroke-linecap="round" stroke-linejoin="round"/>
        <rect x="248" y="400" width="528" height="26" fill="black"/>
      </mask></defs>
      <g transform="${t}">
        <rect x="248" y="270" width="528" height="500" rx="80" fill="white" mask="url(#m)"/>
        <rect x="364" y="200" width="56" height="130" rx="28" fill="white"/>
        <rect x="604" y="200" width="56" height="130" rx="28" fill="white"/>
      </g>`;
  }
  return `
    <defs><clipPath id="c"><rect x="248" y="270" width="528" height="500" rx="80"/></clipPath></defs>
    <g transform="${t}">
      <g clip-path="url(#c)">
        <rect x="248" y="270" width="528" height="500" fill="white"/>
        <rect x="248" y="270" width="528" height="140" fill="${CLARO}"/>
      </g>
      <rect x="364" y="200" width="56" height="130" rx="28" fill="${OSCURO}" stroke="white" stroke-width="18"/>
      <rect x="604" y="200" width="56" height="130" rx="28" fill="${OSCURO}" stroke="white" stroke-width="18"/>
      <polyline points="372,600 470,692 660,500" fill="none" stroke="${INDIGO}" stroke-width="76" stroke-linecap="round" stroke-linejoin="round"/>
    </g>`;
}

const svg = (cuerpo, fondo) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    ${fondo ? `<rect width="1024" height="1024" fill="${fondo}"/>` : ''}${cuerpo}</svg>`;

function png(nombre, contenido, ancho = 1024) {
  const r = new Resvg(contenido, { fitTo: { mode: 'width', value: ancho } });
  writeFileSync(join(out, nombre), r.render().asPng());
  console.log(nombre);
}

// Ícono clásico: el sistema le recorta las esquinas, así que va a sangre.
png('icon.png', svg(glifo(1.0), INDIGO));
// Adaptativo: Android puede recortar hasta un círculo de 2/3, el glifo queda dentro.
png('android-icon-foreground.png', svg(glifo(0.85)));
png('android-icon-background.png', svg('', INDIGO));
png('android-icon-monochrome.png', svg(glifo(0.85, { mono: true })));
png('splash-icon.png', svg(glifo(1.0)));
png('favicon.png', svg(glifo(1.1), INDIGO), 48);

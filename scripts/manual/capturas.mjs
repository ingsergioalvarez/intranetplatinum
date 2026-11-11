/**
 * Revisa el estado de las capturas del manual (A-74). Lee los marcadores `{{captura:ID|descripción}}` de `docs/manual/*.md`
 * y los compara con los `.png` de `docs/manual/capturas/<manual>/`.
 *
 * Uso: `npm run manual:capturas` desde la raíz. Muestra, por manual, cuáles están hechas y cuáles faltan, y avisa de
 * archivos sueltos: un `.png` que no corresponde a ningún marcador (nombre mal escrito) o que está en la carpeta de otro manual.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MANUAL = join(RAIZ, 'docs', 'manual');
const CAPTURAS = join(MANUAL, 'capturas');

/** Letra del ID -> carpeta (y archivo de texto) de su manual. */
const MANUALES = [
  { letra: 'C', carpeta: 'comun', nombre: 'Parte común' },
  { letra: 'G', carpeta: 'guardia', nombre: 'Manual del Guardia' },
  { letra: 'S', carpeta: 'supervisor', nombre: 'Manual del Supervisor' },
  { letra: 'A', carpeta: 'admin', nombre: 'Manual del Administrador' },
  { letra: 'K', carpeta: 'cliente', nombre: 'Manual del Cliente' },
];

// Marcadores definidos en los textos.
const marcadores = new Map();
for (const archivo of readdirSync(MANUAL).filter((f) => f.endsWith('.md') && f !== 'README.md')) {
  const texto = readFileSync(join(MANUAL, archivo), 'utf8');
  for (const m of texto.matchAll(/^\{\{captura:([^|}]+)\|([^}]+)\}\}\s*$/gm)) marcadores.set(m[1], m[2]);
}

// Archivos que existen: carpeta + nombre sin extensión.
const archivos = [];
const leer = (dir, carpeta) => {
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir)) {
    const ruta = join(dir, f);
    if (statSync(ruta).isDirectory()) leer(ruta, f);
    else if (/\.png$/i.test(f)) archivos.push({ carpeta, id: f.replace(/\.png$/i, ''), ext: f.slice(-4), tam: statSync(ruta).size });
  }
};
leer(CAPTURAS, '');

let faltan = 0;
let hechas = 0;
for (const { letra, carpeta, nombre } of MANUALES) {
  const ids = [...marcadores.keys()].filter((id) => id.startsWith(letra)).sort();
  if (ids.length === 0) continue;
  console.log(`\n${nombre}  (carpeta capturas/${carpeta}/)`);
  for (const id of ids) {
    const f = archivos.find((a) => a.id === id);
    if (f) {
      hechas += 1;
      const kb = Math.round(f.tam / 1024);
      console.log(`  [x] ${id}.png  ${kb} KB${kb > 200 ? '  <- pesada: conviene optimizarla' : ''}${f.carpeta !== carpeta ? `  <- está en "${f.carpeta || 'capturas/'}", debe ir en "${carpeta}"` : ''}`);
    } else {
      faltan += 1;
      console.log(`  [ ] ${id}.png  ${marcadores.get(id)}`);
    }
  }
}

const sueltas = archivos.filter((a) => !marcadores.has(a.id));
if (sueltas.length > 0) {
  console.log('\nArchivos que no corresponden a ningún marcador (¿nombre mal escrito?):');
  for (const a of sueltas) console.log(`  ? ${a.carpeta ? `${a.carpeta}/` : ''}${a.id}${a.ext}`);
}
console.log(`\nHechas: ${hechas} · Faltan: ${faltan} · Total: ${marcadores.size}`);

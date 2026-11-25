// docs/master/evidencias/SCRUM-1798/mutar-1798.mjs — SCRUM-1798 · el re-anclaje del guard 917 a las pestañas,
// mutado EN LAS DOS DIRECCIONES.
//
// Uso (desde la raíz del árbol):  node docs/master/evidencias/SCRUM-1798/mutar-1798.mjs
//
// `scripts/guard-detalle-trabajo-917.mjs` es un guard de navegador: no es un fichero de `node --test`, así
// que el catálogo `MUTACIONES_QUE_ME_TUMBAN` (que juzga por NOMBRE de test y sólo lee `tests/*.test.mjs`)
// no lo puede mutar. Esto es la «Mutaciones: una vez → <guion>» de la A3: en git, repetible. Mismo
// camino que `docs/master/evidencias/SCRUM-1787/mutar-1787g.mjs`.
//
// Lo que se le exige a un re-anclaje son dos cosas que tiran en sentidos opuestos, y por eso van las dos:
//
//   DIRECCIÓN 1 · el guard NO SE HA VUELTO CIEGO. Abrir la pestaña no puede ser una manera de dar verde:
//     con la pestaña abierta, una cabecera de menos de 44 px tiene que hacer caer F.4, y diciendo el alto
//     que MIDIÓ (un número entre 1 y 43), no un 0 de panel sin pintar.
//
//   DIRECCIÓN 2 · el clic ES lo que hace medir. Sin el re-anclaje el guard mide 0 px (eso ES la base del
//     20-nov: 202 de 244, 42 hallazgos) y con él mide. Y si el clic no puede darse —la pestaña ya no
//     gobierna su panel, o se pulsa y el panel sigue oculto— el guard dice «no supe mirar» (salida 2),
//     nunca un veredicto.
//
// Primero la BASE sin mutar: tiene que salir 0 con 244 de 244 y dejar, en cada una de las 10 páginas de F,
// el rastro «antes: oculto, 0 px · después: a la vista, ≥ 44 px» (la misma tarjeta, antes y después del
// clic). Después, una a una, las cuatro mutaciones. Restaura en `finally` y comprueba los BYTES contra los
// originales de disco.
//
// Salidas: 0 las cuatro hacen lo que deben · 1 alguna NO (mudo) · 2 la base no sale como debe o una
// mutación no aplica · 3 no se pudo restaurar un fichero (hay que mirar el árbol a mano).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const RAIZ = process.cwd();
const GUARD = 'scripts/guard-detalle-trabajo-917.mjs';
const CSS = 'public/dashboard/css/styles.css';
const VISTA = 'public/dashboard/js/jobDetailView.js';

const lineas = (salida) => salida.split(/\r?\n/).map((l) => l.trim());
const hallazgos = (salida) => lineas(salida).filter((l) => /^❌ [A-G]\.\d/.test(l));
const suelos = (salida) => lineas(salida).filter((l) => l.includes('SUELO ·'));
// Los altos que F.4 dice haber medido: «… por debajo de 44 px: Tipo de trabajo 30 · Notas internas 30».
const altosDeF4 = (salida) => hallazgos(salida)
  .filter((l) => /^❌ F\.4 .*cabeceras por debajo de 44 px: /.test(l))
  .map((l) => l.split('cabeceras por debajo de 44 px: ')[1].split(' · ').map((trozo) => Number(trozo.split(' ').pop())));

const PAGINAS_DE_F = 10; // 5 casos × 2 anchuras

/** Cada `espera` devuelve la lista de lo que NO se cumple: vacía es «hace lo que debe». */
export const MUTACIONES = [
  {
    id: 'DIRECCIÓN 1 · cabecera de 30 px DENTRO de la pestaña abierta (el guard no se volvió ciego)',
    fichero: CSS,
    cambiar: (s) => s.replace(/(\.detail-plega-cab \{\r?\n  list-style: none; cursor: pointer;\r?\n  display: flex; align-items: center; gap: 10px;\r?\n  )min-height: 44px; padding: 6px 0;/, '$1min-height: 30px; padding: 0;'),
    salida: 1,
    espera: (s) => {
      const f = [];
      const h = hallazgos(s);
      const altos = altosDeF4(s);
      if (altos.length !== PAGINAS_DE_F) f.push(`F.4 cae en ${altos.length} páginas, esperaba ${PAGINAS_DE_F}`);
      const todos = altos.flat();
      if (!todos.length || todos.some((n) => !(n > 0 && n < 44))) f.push(`F.4 no dice altos MEDIDOS entre 1 y 43: ${JSON.stringify(altos)}`);
      if (h.length !== altos.length) f.push(`caen ${h.length} comprobaciones y sólo ${altos.length} son la F.4 de las cabeceras`);
      if (suelos(s).length) f.push(`${suelos(s).length} SUELOS: no midió, se quedó ciego`);
      return f;
    },
  },
  {
    id: 'DIRECCIÓN 2 · sin el re-anclaje mide 0 px: es la BASE del 20-nov (202 de 244, 42 hallazgos)',
    fichero: GUARD,
    cambiar: (s) => s.replace("      if (!tarjeta) return { sinTarjeta: true };\n      const panel = tarjeta.closest", "      return { sinTarjeta: true };\n      const panel = tarjeta.closest").replace("      if (!tarjeta) return { sinTarjeta: true };\r\n      const panel = tarjeta.closest", "      return { sinTarjeta: true };\r\n      const panel = tarjeta.closest"),
    salida: 1,
    espera: (s) => {
      const f = [];
      const h = hallazgos(s);
      const altos = altosDeF4(s);
      const f7 = h.filter((l) => l.startsWith('❌ F.7 ')).length;
      if (!s.includes('el detalle NO cuadra con su inventario: 202 de 244.')) f.push('no dice «202 de 244»');
      if (!s.includes('42 hallazgos · 0 ciegos')) f.push('no dice «42 hallazgos · 0 ciegos»');
      if (altos.length !== PAGINAS_DE_F || altos.flat().some((n) => n !== 0)) f.push(`F.4 no mide 0 px en las ${PAGINAS_DE_F} páginas: ${JSON.stringify(altos)}`);
      if (f7 !== 32) f.push(`F.7 cae ${f7} veces, la base son 32`);
      return f;
    },
  },
  {
    id: 'DIRECCIÓN 2 · se quita SÓLO el clic: el panel sigue oculto y el guard dice «no supe mirar»',
    fichero: GUARD,
    cambiar: (s) => s.replace('      pestanas[0].click();\n', '').replace('      pestanas[0].click();\r\n', ''),
    salida: 2,
    espera: (s) => {
      const f = [];
      const n = suelos(s).filter((l) => /sigue oculto: no juzgo una tarjeta sin pintar/.test(l)).length;
      if (n !== PAGINAS_DE_F) f.push(`${n} SUELOS «sigue oculto», esperaba ${PAGINAS_DE_F}`);
      if (hallazgos(s).some((l) => /^❌ F\./.test(l))) f.push('juzga F sobre una tarjeta que no abrió');
      if (s.includes('✅ el detalle cuadra con su inventario')) f.push('da VERDE sin haber abierto la pestaña');
      return f;
    },
  },
  {
    id: 'DIRECCIÓN 2 · la pestaña deja de gobernar su panel (aria-controls roto): «no supe mirar»',
    fichero: VISTA,
    cambiar: (s) => s.replace("pstBoton.setAttribute('aria-controls', `ficha-panel-${pstI}`);", "pstBoton.setAttribute('aria-controls', `ficha-otro-${pstI}`);"),
    salida: 2,
    espera: (s) => {
      const f = [];
      const n = suelos(s).filter((l) => /lo gobiernan 0 pestañas/.test(l)).length;
      if (n !== PAGINAS_DE_F) f.push(`${n} SUELOS «lo gobiernan 0 pestañas», esperaba ${PAGINAS_DE_F}`);
      if (hallazgos(s).some((l) => /^❌ F\./.test(l))) f.push('juzga F sobre una tarjeta que no abrió');
      if (s.includes('✅ el detalle cuadra con su inventario')) f.push('da VERDE sin haber abierto la pestaña');
      return f;
    },
  },
];

const correr = () => spawnSync(process.execPath, [GUARD], { cwd: RAIZ, encoding: 'utf8', timeout: 240_000 });
const textoDe = (r) => (r.stdout || '') + (r.stderr || '');
const resumenDe = (s) => lineas(s).filter((l) => /^población: |el detalle (NO )?cuadra|⟦veredicto⟧/.test(l));

const base = correr();
const salidaBase = textoDe(base);
const rastro = lineas(salidaBase).map((l) => /^↪ F .*antes: oculto, 1ª cabecera 0 px · después: a la vista, ([\d.]+) px$/.exec(l)).filter(Boolean);
const fallosBase = [];
if (base.status !== 0) fallosBase.push(`salida ${base.status}, esperaba 0`);
if (!salidaBase.includes('✅ el detalle cuadra con su inventario: 244 de 244.')) fallosBase.push('no dice «244 de 244»');
if (rastro.length !== PAGINAS_DE_F) fallosBase.push(`${rastro.length} páginas con el rastro «0 px antes del clic», esperaba ${PAGINAS_DE_F}`);
if (rastro.some((m) => !(Number(m[1]) >= 44))) fallosBase.push(`tras el clic alguna cabecera no llega a 44: ${rastro.map((m) => m[1]).join(' · ')}`);
console.log(`BASE sin mutar → salida ${base.status} · ${resumenDe(salidaBase).join(' · ')}`);
console.log(`       el clic, en las ${rastro.length} páginas de F: antes oculto y 0 px · después a la vista y ${rastro.map((m) => m[1]).join(' · ')} px`);
if (fallosBase.length) { console.error('✖ LA BASE NO SALE COMO DEBE: ' + fallosBase.join(' · ')); console.error(salidaBase.split('\n').slice(-12).join('\n')); process.exit(2); }

let mudas = 0; let ciegas = 0;
for (const m of MUTACIONES) {
  const abs = path.join(RAIZ, m.fichero);
  const original = fs.readFileSync(abs);
  const mutado = m.cambiar(original.toString('utf8'));
  if (mutado === original.toString('utf8')) { console.error(`✖ ${m.id} → NO APLICA: el texto a mutar no está en ${m.fichero}`); ciegas += 1; continue; }
  let r;
  try {
    fs.writeFileSync(abs, mutado);
    r = correr();
  } finally {
    fs.writeFileSync(abs, original);
    if (!fs.readFileSync(abs).equals(original)) { console.error(`☠ NO RESTAURADO: ${m.fichero}`); process.exit(3); }
  }
  const salida = textoDe(r);
  const fallos = m.espera(salida);
  if (r.status !== m.salida) fallos.unshift(`salida ${r.status}, esperaba ${m.salida}`);
  const bien = !fallos.length;
  console.log(`${bien ? '✔ CAE ' : '✖ MUDA'} · ${m.id}`);
  console.log(`       ${m.fichero} → salida ${r.status} · ${resumenDe(salida).join(' · ')}`);
  const muestra = [...hallazgos(salida), ...suelos(salida)];
  console.log(`       ${muestra.length} líneas en rojo o en suelo; la primera: ${(muestra[0] || '—').slice(0, 230)}`);
  if (!bien) { mudas += 1; console.error('       NO se cumple: ' + fallos.join(' · ')); }
}
console.log(`${MUTACIONES.length} mutaciones · ${MUTACIONES.length - mudas - ciegas} hacen lo que deben · ${mudas} mudas · ${ciegas} no aplican`);
process.exit(ciegas ? 2 : mudas ? 1 : 0);

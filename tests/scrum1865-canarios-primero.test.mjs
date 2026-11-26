// tests/scrum1865-canarios-primero.test.mjs — SCRUM-1865
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LA PARED CORTA LA COLA, Y LOS CANARIOS NO PUEDEN IR EN LA COLA
//
// Medido por S3 el 25-nov-2026 (descripción de SCRUM-1865): en un runner lento la pared de la tanda
// (`PARED_MS`, `scripts/_trinquete-de-zona-hijo.mjs`) cortaba la COLA de la lista, y la línea de
// órdenes ponía los cuatro canarios AL FINAL (`scripts/trinquete-de-zona.mjs`: `[...deLaTanda,
// ...canarios]`). Sin resultado de los canarios el autocontrol no se cumple → CIEGO. Ocho PR de ese
// día salieron CIEGO por eso, y cuatro de control salieron verdes con la misma tanda.
//
// Aquí se reproduce el corte con una tanda SEMBRADA LENTA: tantos ficheros que no acaban como huecos
// de concurrencia tiene el hijo (y uno más), con una pared de segundos, y los canarios DETRÁS, en el
// orden de la línea de órdenes. Sin la cura ① los lentos llenan todos los huecos, la pared salta y
// los canarios no llegan a arrancar: CIEGO, como el 25-nov. Con la cura, `medirEnZona` los pone
// DELANTE y su veredicto no depende de dónde se corte la tanda.
//
// El control es una tanda RÁPIDA con el mismo orden: no salta la pared, los canarios se juzgan
// como hoy, y la pared que el hijo declara es la de la cura ② (sin topes sembrados).
//
// 💰 COSTE: la pared sembrada es de 4 s, el mismo suelo que SCRUM-1494 midió para que el CI cargado
// no corte también lo sano. Dos zonas × 4 s, más la repesca de los cuatro canarios (segundos) y la
// tanda rápida. Vive en su propio fichero porque mide AL CARGAR (ver la cabecera de
// `tests/scrum1494-cortados-de-zona.test.mjs`, SCRUM-935d): `scrum813` se carga 27 veces en
// `meta:mutaciones`, y éste sólo 1 + 2.
//
// ⚠️ LÍMITE DECLARADO: la repesca se hace SOLO de los canarios. Los lentos cortados a solas costarían
// 4 s × 2 zonas cada uno, y lo que aquí se juzga es el autocontrol, que sólo mira a los canarios.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';   // SCRUM-730: `pathname` no decodifica el espacio
import { temporal } from './_temporal.mjs';

import {
  ZONAS, compararZonas, escribirCanarios, juzgarCanarios, medirEnZona, repescar, resolverRepesca,
} from '../scripts/_trinquete-de-zona.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 🔴 MUTACIONES_QUE_ME_TUMBAN · SCRUM-745. Cada una imita el defecto que este guard promete cazar.
// Se ejecutan con `npm run meta:mutaciones`: aplica, exige el ROJO, restaura y compara bytes.
export const MUTACIONES_QUE_ME_TUMBAN = [
  // ① LOS CANARIOS VUELVEN A LA COLA: la lista se mide en el orden en que llega, que en la línea de
  //    órdenes es la tanda primero. Es exactamente lo que cegó la cola del 25-nov.
  {
    fichero: 'scripts/_trinquete-de-zona.mjs',
    de: '  const enOrden = canariosPrimero(ficheros, raiz);',
    a: '  const enOrden = ficheros;',
    cae: 'SCRUM-1865 · 🔴 con la cola CORTADA, los canarios se miden igual y el autocontrol se cumple',
  },
  // ② LA PARED VUELVE A LOS 15 MIN: la que una pasada normal de 10-15 min ya rozaba el 25-nov.
  {
    fichero: 'scripts/_trinquete-de-zona-hijo.mjs',
    de: 'const PARED_TANDA_MS = 24 * 60_000;',
    a: 'const PARED_TANDA_MS = 15 * 60_000;',
    cae: 'SCRUM-1865 · CONTROL: una tanda RÁPIDA en el mismo orden no salta la pared y los canarios se juzgan como hoy',
  },
];

const dir = temporal('scrum1865-');
const canarios = escribirCanarios(path.join(dir, 'canarios'), RAIZ);
const rutasCanario = new Set(canarios.map((c) => c.rutaClave));

// Uno más que los huecos que abre el hijo (`availableParallelism() - 1`): así, si los lentos van
// delante, NINGÚN canario arranca antes de la pared.
const HUECOS = Math.max(1, os.availableParallelism() - 1);
const sembrar = (sub, n, cuerpo) => {
  const d = path.join(dir, sub);
  fs.mkdirSync(d, { recursive: true });
  return Array.from({ length: n }, (_, i) => {
    const ruta = path.join(d, `${sub}-${String(i).padStart(2, '0')}.test.mjs`);
    fs.writeFileSync(ruta, `import test from 'node:test';\ntest('${sub} ${i}', async () => { ${cuerpo} });\n`);
    return ruta;
  });
};
const lentos = sembrar('lento', HUECOS + 1, 'await new Promise((r) => setTimeout(r, 15_000));');
// Ocho rápidos + cuatro canarios = 12 ficheros → la pared por fichero (2 min × 12) es 24 min, así
// que la que el hijo declara es la de la TANDA y no la de «pocos ficheros».
const rapidos = sembrar('rapido', 8, '');

const TOPES_SEMBRADOS = { limiteTestMs: 60_000, paredMs: 4000 };
const medirConTopes = (o) => medirEnZona({ ...o, topes: TOPES_SEMBRADOS });

/** El mismo camino que el job: tanda → comparar → repesca de los canarios → autocontrol. */
function medirComoElJob(tanda, medir, etiqueta) {
  // 🔴 EL ORDEN DE LA LÍNEA DE ÓRDENES (`scripts/trinquete-de-zona.mjs`): la tanda, y DETRÁS los
  // canarios. El test no lo corrige: la cura tiene que estar en el instrumento.
  const ficheros = [...tanda, ...canarios.map((c) => c.ruta)];
  const medidas = ZONAS.map((zona) => medir({
    zona, ficheros, raiz: RAIZ, salida: path.join(dir, `${etiqueta}-${zona.replace(/\W/g, '_')}.json`),
  }));
  const enLaTanda = medidas.every((m) => m.ok) ? compararZonas(medidas) : { cambian: [], sinComparar: [] };
  const candidatas = [...enLaTanda.cambian, ...enLaTanda.sinComparar].filter((c) => rutasCanario.has(c.fichero));
  const r = resolverRepesca({
    cambian: enLaTanda.cambian.filter((c) => rutasCanario.has(c.fichero)),
    sinComparar: enLaTanda.sinComparar.filter((c) => rutasCanario.has(c.fichero)),
    aSolas: repescar({ candidatas, raiz: RAIZ, dirTrabajo: dir, medir }),
  });
  return { medidas, controles: juzgarCanarios(r.confirmadas, canarios, r.sinComparar) };
}

const cortada = medirComoElJob(lentos, medirConTopes, 'cortada');
const rapida = medirComoElJob(rapidos, medirEnZona, 'rapida');

test('SCRUM-1865 · SUELO del sembrado: la pared SALTA en las dos zonas y corta a los lentos', () => {
  // Sin esto, «los canarios se miden» se cumpliría sobre una tanda que no se cortó.
  for (const m of cortada.medidas) {
    assert.equal(m.ok, true, `🔴 la pasada en \`${m.zona}\` no midió: ${m.porque}`);
    assert.equal(m.topes.saltoLaPared, true, `🔴 EL SEMBRADO NO SIEMBRA: en \`${m.zona}\` no saltó la pared`);
    assert.ok(m.segundos < 40, `🔴 la pasada de \`${m.zona}\` tardó ${m.segundos} s: la pared no cortó`);
  }
});

test('SCRUM-1865 · 🔴 con la cola CORTADA, los canarios se miden igual y el autocontrol se cumple', () => {
  // Primero el veredicto (es lo que el job imprime) y luego la causa, canario a canario.
  assert.equal(cortada.controles.ok, true,
    `🔴 CIEGO como el 25-nov: el autocontrol no se cumple con la cola cortada. ${JSON.stringify(cortada.controles.fallos)}`);
  for (const m of cortada.medidas) {
    for (const c of canarios) {
      const suyas = [...m.veredictos].filter(([k]) => k.startsWith(`${c.rutaClave}::`));
      assert.ok(suyas.length > 0 && suyas.every(([, v]) => v === 'pass' || v === 'fail'),
        `🔴 en \`${m.zona}\` el canario \`${c.fichero}\` no dejó resultado (${JSON.stringify(suyas)}): `
        + 'la pared lo ha cortado porque iba en la cola');
    }
  }
});

test('SCRUM-1865 · CONTROL: una tanda RÁPIDA en el mismo orden no salta la pared y los canarios se juzgan como hoy', () => {
  for (const m of rapida.medidas) {
    assert.equal(m.ok, true, `🔴 la pasada en \`${m.zona}\` no midió: ${m.porque}`);
    assert.equal(m.topes.saltoLaPared, false, `🔴 en \`${m.zona}\` una tanda rápida ha saltado la pared`);
    // La pared que el hijo usa SIN topes sembrados: la de la tanda, subida por la regla escrita en el
    // propio hijo (1,6 × la pasada más lenta medida; 15 min el 25-nov → 24 min).
    assert.ok(m.topes.paredMs >= 24 * 60_000,
      `🔴 la pared de la tanda es ${m.topes.paredMs / 60_000} min: por debajo de 1,6 × los 15 min medidos el 25-nov`);
  }
  assert.equal(rapida.controles.ok, true, `🔴 el autocontrol no se cumple ni sin corte: ${JSON.stringify(rapida.controles.fallos)}`);
});

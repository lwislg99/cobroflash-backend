// tests/scrum1494-cortados-de-zona.test.mjs — SCRUM-1494 (sacado de scrum813 en SCRUM-935d)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-1494 · UN FICHERO QUE NO ACABA SE CORTA, SALE CON SU NOMBRE, Y NO ACUSA A NADIE
//
// El 6-oct ocho jobs de zona se comieron los 45 min del techo sin decir qué fichero se colgaba.
// Aquí se siembran los dos cuelgues que el banco de SCRUM-1494b separó, los dos SÓLO en Midway:
//   · `al-cargar` — un `await` de nivel superior que no vuelve. El `timeout` por test NO lo corta;
//                   lo corta la pared.
//   · `en-test`   — un test que no acaba, dentro de un `describe`. Lo corta el `timeout` por test,
//                   y su `describe` sale con `subtestsFailed`, que NO puede leerse como una caída.
// Con el código de antes este fichero NO TERMINA (visto el 15-oct, registro 1494c): el hijo espera
// para siempre al cuelgue al cargar.
//
// 💰 COSTE, y va al registro para que nadie lo agrande sin saberlo: con estos topes (1 s por test,
// 4 s de pared) cuesta ~4 s la pasada de Midway en la tanda y otros ~4+1 s en la repesca. Kiritimati
// no espera a nada. Bajar la pared por debajo de 4 s haría que el CI, cargado, cortara también lo sano.
//
// ── 🔴 POR QUÉ VIVE EN SU PROPIO FICHERO (SCRUM-935d) ─────────────────────────────────────────
// Hasta el 22-oct este banco estaba al final de `scrum813-trinquete-de-zona.test.mjs`, y corre en
// el NIVEL SUPERIOR del módulo: se paga en CADA carga del fichero, no en cada test. `meta:mutaciones`
// carga el fichero entero una vez limpio y otra por cada mutación declarada, así que con 26
// mutaciones en `scrum813` este banco se pagaba 27 veces (A/B de J6 en SCRUM-935c: 1,9 s → 11,5 s
// por carga desde #2486). Aquí se carga 1 + 2 veces: las dos únicas mutaciones cuyo `cae` necesita
// el banco. Las otras dos de SCRUM-1494 (㉕ ㉖) se quedan en `scrum813`: sus tests son de datos
// fabricados y no miran el banco.
//
// ⛔ NO MUEVAS AQUÍ un test que no necesite el banco, ni pongas aquí una mutación cuyo `cae` no lo
// mire: cada mutación más son ~10 s más de meta-guard en cada PR.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';   // SCRUM-730: `pathname` no decodifica el espacio
import { temporal } from './_temporal.mjs';

import {
  CORTADA, ZONAS, compararZonas, medirEnZona, repescar, resolverRepesca, veredicto,
} from '../scripts/_trinquete-de-zona.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 🔴 MUTACIONES_QUE_ME_TUMBAN · SCRUM-745. Cada una imita el defecto que este guard promete cazar.
// Se ejecutan con `npm run meta:mutaciones`: aplica, exige el ROJO, restaura y compara bytes.
// ⚠️ La que quita el `signal` de pared NO está aquí a propósito: su rojo es un cuelgue, y un
// cuelgue dentro de `meta:mutaciones` se comería su propio techo. Su rojo se vio con el banco.
export const MUTACIONES_QUE_ME_TUMBAN = [
  // ㉓ EL CORTE VUELVE A SER UNA CAÍDA: un fichero cortado en una zona sola acusa de zona.
  {
    fichero: 'scripts/_trinquete-de-zona-hijo.mjs',
    de: '    if (CORTES.has(tipo)) v = CORTADA;',
    a: '    if (false) v = CORTADA;',
    cae: 'SEMBRADO: un cuelgue en una zona sola se CORTA y no acusa a nadie',
  },
  // ㉔ EL PADRE DEL CORTADO CAE: la acusación vuelve por el `describe` (`subtestsFailed`).
  {
    fichero: 'scripts/_trinquete-de-zona-hijo.mjs',
    de: "    else if (tipo === 'subtestsFailed' && hijos?.corte && !hijos.real) v = CORTADA;",
    a: '    else if (false) v = CORTADA;',
    cae: 'SEMBRADO: el `describe` de un test cortado sale cortado, no caído',
  },
];

const CONTROLES_OK = { ok: true, fallos: [] };
const CABECERA_SEMBRADA = `import test from 'node:test';
import assert from 'node:assert/strict';
const ZONA = Intl.DateTimeFormat().resolvedOptions().timeZone;
`;

const TOPES_SEMBRADOS = { limiteTestMs: 1000, paredMs: 4000 };
const CUELGA_EN_MIDWAY = "if (ZONA === 'Pacific/Midway') { setInterval(() => {}, 1000); await new Promise(() => {}); }\n";
const CORTADOS = {
  'cortado-al-cargar.test.mjs': `${CABECERA_SEMBRADA}${CUELGA_EN_MIDWAY}
test('cortado · pasa donde carga', () => {});
`,
  'cortado-en-test.test.mjs': `${CABECERA_SEMBRADA}import { describe } from 'node:test';
describe('cortado · grupo', () => {
  test('cortado · se cuelga en Midway', async () => { ${CUELGA_EN_MIDWAY.trim()} });
  test('cortado · hermano sano', () => {});
});
`,
};
const dirCortados = path.join(temporal('scrum1494-'), 'cortados');
fs.mkdirSync(dirCortados, { recursive: true });
const cortados = Object.entries(CORTADOS).map(([nombre, codigo]) => {
  const ruta = path.join(dirCortados, nombre);
  fs.writeFileSync(ruta, codigo);
  return { nombre, ruta, rutaClave: path.relative(RAIZ, ruta).split(path.sep).join('/') };
});
const medirConTopes = (o) => medirEnZona({ ...o, topes: TOPES_SEMBRADOS });
const medidasCortadas = ZONAS.map((zona) => medirConTopes({
  zona, ficheros: cortados.map((s) => s.ruta), raiz: RAIZ,
  salida: path.join(dirCortados, `${zona.replace(/\W/g, '_')}.json`),
}));
const tandaCortada = medidasCortadas.every((m) => m.ok)
  ? compararZonas(medidasCortadas) : { cambian: [], sinComparar: [] };
const finalCortado = resolverRepesca({
  ...tandaCortada,
  aSolas: repescar({
    candidatas: [...tandaCortada.cambian, ...tandaCortada.sinComparar],
    raiz: RAIZ, dirTrabajo: dirCortados, medir: medirConTopes,
  }),
});
const claveCortada = (nombre, prueba) => `${cortados.find((s) => s.nombre === nombre).rutaClave}::${prueba}`;

test('SCRUM-1494 · SUELO del sembrado: las dos pasadas ACABAN, y en Midway lo colgado sale CORTADO con su nombre', () => {
  for (const m of medidasCortadas) assert.equal(m.ok, true, `🔴 la pasada en \`${m.zona}\` no midió: ${m.porque}`);
  const [kiritimati, midway] = medidasCortadas;
  // Control positivo: en Kiritimati el sembrado corre entero y pasa. Si no, «no acusa» se cumpliría
  // porque no habría nada que comparar.
  assert.equal(kiritimati.veredictos.get(claveCortada('cortado-al-cargar.test.mjs', 'cortado · pasa donde carga')), 'pass');
  assert.equal(kiritimati.veredictos.get(claveCortada('cortado-en-test.test.mjs', 'cortado · se cuelga en Midway')), 'pass');
  assert.equal(kiritimati.topes.saltoLaPared, false, '🔴 en Kiritimati no se cuelga nada y aun así saltó la pared');

  assert.equal(midway.topes.saltoLaPared, true, '🔴 EL SEMBRADO NO SIEMBRA: en Midway no hizo falta la pared');
  assert.ok(midway.segundos < 30, `🔴 la pasada de Midway tardó ${midway.segundos} s: la pared no cortó`);
  const deMidway = (nombre) => [...midway.veredictos].filter(([k]) => k.startsWith(cortados.find((s) => s.nombre === nombre).rutaClave));
  assert.deepEqual(deMidway('cortado-al-cargar.test.mjs').map(([, v]) => v), [CORTADA],
    '🔴 el fichero colgado AL CARGAR no sale nombrado como cortado');
  assert.equal(midway.veredictos.get(claveCortada('cortado-en-test.test.mjs', 'cortado · se cuelga en Midway')), CORTADA);
  assert.equal(midway.veredictos.get(claveCortada('cortado-en-test.test.mjs', 'cortado · hermano sano')), 'pass',
    '🔴 el corte de un test se ha llevado por delante a su hermano, que acaba');
});

test('SCRUM-1494 · 🔴 SEMBRADO: el `describe` de un test cortado sale cortado, no caído', () => {
  const [, midway] = medidasCortadas;
  assert.equal(midway.veredictos.get(claveCortada('cortado-en-test.test.mjs', 'cortado · grupo')), CORTADA,
    '🔴 el padre de un test cortado ha salido `fail` (`subtestsFailed`): frente al `pass` de la otra zona sería una acusación sin dato');
});

test('SCRUM-1494 · 🔴 SEMBRADO: un cuelgue en una zona sola se CORTA y no acusa a nadie', () => {
  const deLosCortados = (lista) => lista.filter((c) => cortados.some((s) => s.rutaClave === c.fichero));
  assert.deepEqual(deLosCortados(finalCortado.confirmadas).map((c) => c.clave), [],
    '🔴 un fichero que se cuelga en una zona ha salido acusado de depender de ella');
  const pendientes = deLosCortados(finalCortado.sinComparar).map((c) => c.clave);
  for (const clave of [
    claveCortada('cortado-al-cargar.test.mjs', 'cortado · pasa donde carga'),
    claveCortada('cortado-en-test.test.mjs', 'cortado · se cuelga en Midway'),
    claveCortada('cortado-en-test.test.mjs', 'cortado · grupo'),
  ]) {
    assert.ok(pendientes.includes(clave), `🔴 «${clave}» no acusa Y TAMPOCO se cuenta: se ha callado. Sin comparar: ${JSON.stringify(pendientes)}`);
  }
  const v = veredicto({
    cambianEnElArbol: deLosCortados(finalCortado.confirmadas), censadas: [], medidas: medidasCortadas,
    controles: CONTROLES_OK, sinComparar: deLosCortados(finalCortado.sinComparar),
  });
  assert.equal(v.estado, 'OK');
  assert.ok(v.sinComparar.length >= 3, '🔴 el verde no dice cuántas no pudo comparar');
});

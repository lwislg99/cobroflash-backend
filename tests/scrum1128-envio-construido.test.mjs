// tests/scrum1128-envio-construido.test.mjs — SCRUM-1128.
//
// «ENVÍO CONSTRUIDO» YA NO ES «LAS PIEZAS EXISTEN». Antes bastaba una fila `model VfSubmission`
// en el esquema para que la familia B dejara de bloquear afirmaciones fiscales en la landing
// (medido en SCRUM-1127). El criterio nuevo, aprobado por el fundador el 25-sep-2026, exige LAS
// DOS COSAS A LA VEZ: un llamante del cliente de envío en `src/` Y `SIF_ENABLED` en ON por
// defecto en `src/core/flags.ts`.
//
// Se prueba sobre RAÍCES FABRICADAS en un directorio temporal (fuera del árbol), con un `src/`, un
// `flags.ts` y un `schema.prisma` mínimos. El árbol real lo vigila `scrum537`.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  envioConstruido, comprobar, flagPorDefecto, llamadasAlEnvio, FLAG_DEL_ENVIO, FUNCION_DE_ENVIO,
} from '../scripts/_guard-afirmacion-fiscal.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1128-'));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

// ─────────────────────────────────────────────────────────── las piezas de la raíz

const FLAGS = (on) => `export const FLAG_DEFAULTS = {
  INVOICING_ES_ENABLED: false,
  ${FLAG_DEL_ENVIO}: ${on ? 'true' : 'false'},                // global ES
  PAYMENTS_CONNECT_ENABLED: false,
} as const;
`;

const ESQUEMA = (conCola) => `model Invoice {
  id Int @id
}
${conCola ? 'model VfSubmission {\n  id Int @id\n}\n' : ''}`;

/** El cliente, con la llamada de red y SIN host (como el de SCRUM-1127). */
const CLIENTE = `import https from 'node:https';
export async function ${FUNCION_DE_ENVIO}(p: { endpoint: string }) { return https.request(p.endpoint); }
`;

/** Un llamante de verdad: importa como valor y llama. */
const LLAMANTE = `import { ${FUNCION_DE_ENVIO} } from '../fiscal/verifactu/sif.client';
export async function remitir() { return ${FUNCION_DE_ENVIO}({ endpoint: process.env.X ?? '' }); }
`;

/** Una pieza con host AEAT y red en el mismo fichero: el criterio viejo la contaba como envío. */
const HOST_CON_RED = `import https from 'node:https';
const URL_ENVIO = 'https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP';
export const agente = new https.Agent({});
`;

let n = 0;
function raiz({ cola = false, llamante = null, flagOn = false, hostConRed = false, flags = undefined } = {}) {
  const r = path.join(TMP, `r${++n}`);
  const escribir = (rel, txt) => {
    fs.mkdirSync(path.dirname(path.join(r, rel)), { recursive: true });
    fs.writeFileSync(path.join(r, rel), txt);
  };
  escribir('prisma/schema.prisma', ESQUEMA(cola));
  if (flags !== null) escribir('src/core/flags.ts', flags ?? FLAGS(flagOn));
  escribir('src/modules/fiscal/verifactu/sif.client.ts', CLIENTE);
  escribir('src/modules/invoicing/domain/qr.ts', "export const QR = 'https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR?x=1';\n");
  if (llamante) escribir('src/modules/invoicing/domain/remitir.ts', llamante);
  if (hostConRed) escribir('src/modules/fiscal/verifactu/transporte.ts', HOST_CON_RED);
  return r;
}

const FRASES = [
  '<p>Nuestra facturación es conforme a la AEAT.</p>',
  '<p>La facturación VeriFactu ya está construida.</p>',
];
const bloquea = (construido) => FRASES.every((f) => !comprobar({ paginas: [{ ruta: 'x', html: f }], envioConstruido: construido }).ok);
const deja = (construido) => FRASES.every((f) => comprobar({ paginas: [{ ruta: 'x', html: f }], envioConstruido: construido }).ok);

// ═════════════════════════════════════════════════ ① EN ROJO: el caso que importa

test('SCRUM-1128 · 🔴 EN ROJO: con `model VfSubmission`, SIN llamante y flag en OFF, la familia B SIGUE bloqueando', () => {
  const h = envioConstruido(raiz({ cola: true }));
  // La pieza se VE (el detector no está ciego)…
  assert.deepEqual(h.señales.map((s) => s.tipo), ['cola'], 'CIEGO: no ve la cola del esquema');
  assert.equal(h.flag.leido, true, 'CIEGO: no leyó el flag');
  // …y aun así NO cuenta como envío.
  assert.equal(h.construido, false,
    '🔴 una FILA en el esquema vuelve a desbloquear los claims fiscales de la landing');
  assert.ok(bloquea(h.construido), '🔴 la familia B/C deja pasar «conforme a la AEAT» sin envío');
});

test('SCRUM-1128 · 🔴 una sola de las dos condiciones NO basta, en ningún orden', () => {
  const casos = {
    'cola + llamante, flag OFF': { cola: true, llamante: LLAMANTE, flagOn: false },
    'cola + flag ON, sin llamante': { cola: true, flagOn: true },
    'llamante, flag OFF': { llamante: LLAMANTE },
    'flag ON, sin llamante': { flagOn: true },
    'host AEAT + red en un fichero (el criterio viejo decía SÍ), flag ON': { hostConRed: true, flagOn: true },
  };
  for (const [nombre, c] of Object.entries(casos)) {
    const h = envioConstruido(raiz(c));
    assert.equal(h.construido, false, `🔴 ${nombre} → dio «construido»`);
    assert.ok(bloquea(h.construido), nombre);
  }
});

test('SCRUM-1128 · el criterio viejo SÍ habría dado «construido» en esos casos: la pieza se sigue viendo', () => {
  // Control de que el rojo de arriba mide algo: las piezas que antes decidían siguen apareciendo.
  const h = envioConstruido(raiz({ cola: true, hostConRed: true }));
  assert.deepEqual(h.señales.map((s) => s.tipo).sort(), ['cola', 'host-aeat']);
  assert.ok(h.vistosAeat >= 2, 'CIEGO: no ve ni el QR ni el host');
  assert.equal(h.construido, false);
});

// ═════════════════════════════════════════════════ ② CONTROL POSITIVO

test('SCRUM-1128 · ✅ CONTROL POSITIVO: con llamante Y flag en ON, la familia B DEJA de bloquear', () => {
  const h = envioConstruido(raiz({ cola: true, llamante: LLAMANTE, flagOn: true }));
  assert.equal(h.construido, true,
    '🔴 con el envío cableado y encendido sigue bloqueando: se ha APAGADO el guard en vez de afinarlo');
  assert.deepEqual(h.llamantes, [{ donde: 'src/modules/invoicing/domain/remitir.ts', llamadas: 1 }]);
  assert.ok(deja(h.construido), '🔴 el día que sea verdad, no se podrá decir');
});

test('SCRUM-1128 · ✅ el llamante vale importado de las tres formas: directo, renombrado y como espacio de nombres', () => {
  const formas = [
    `import { ${FUNCION_DE_ENVIO} as mandar } from './sif.client.js';\nmandar({});\n`,
    `import * as cli from '../../fiscal/verifactu/sif.client';\nawait cli.${FUNCION_DE_ENVIO}({});\n`,
    `import { type X, ${FUNCION_DE_ENVIO} } from '../fiscal/verifactu/sif.client';\n${FUNCION_DE_ENVIO}({} as X);\n`,
  ];
  for (const f of formas) assert.equal(llamadasAlEnvio(f), 1, f);
  for (const f of formas) {
    assert.equal(envioConstruido(raiz({ llamante: f, flagOn: true })).construido, true, f);
  }
});

// ═════════════════════════════════════════════════ ③ LO QUE NO ES UN LLAMANTE

test('SCRUM-1128 · 🔴 NO son llamantes: comentario, cadena, `import type`, import sin llamada, otro módulo', () => {
  const falsos = {
    comentario: `// ${FUNCION_DE_ENVIO}({ endpoint })\nexport const a = 1;\n`,
    cadena: `export const a = '${FUNCION_DE_ENVIO}({})';\n`,
    // Los dos `type` LLAMAN: si no llamaran, que el import sea de tipo no cambiaría nada y
    // la mutación «un import type cuenta» saldría muda (medido: salió muda).
    importType: `import type { ${FUNCION_DE_ENVIO} } from '../fiscal/verifactu/sif.client';\n${FUNCION_DE_ENVIO}({});\n`,
    elementoType: `import { type ${FUNCION_DE_ENVIO} } from '../fiscal/verifactu/sif.client';\n${FUNCION_DE_ENVIO}({});\n`,
    sinLlamar: `import { ${FUNCION_DE_ENVIO} } from '../fiscal/verifactu/sif.client';\nexport const f = ${FUNCION_DE_ENVIO};\n`,
    otroModulo: `import { ${FUNCION_DE_ENVIO} } from './otro.client';\n${FUNCION_DE_ENVIO}({});\n`,
    mismoNombreLocal: `function ${FUNCION_DE_ENVIO}() {}\n${FUNCION_DE_ENVIO}();\n`,
  };
  for (const [nombre, f] of Object.entries(falsos)) {
    assert.equal(llamadasAlEnvio(f), 0, nombre);
    assert.equal(envioConstruido(raiz({ llamante: f, flagOn: true, cola: true })).construido, false, nombre);
  }
});

test('SCRUM-1128 · el cliente y su cola no son llamantes de sí mismos', () => {
  const r = raiz({ flagOn: true });
  fs.writeFileSync(path.join(r, 'src/modules/fiscal/verifactu/sif.cola.ts'),
    `import { ${FUNCION_DE_ENVIO} } from './sif.client';\n${FUNCION_DE_ENVIO}({});\n`);
  const h = envioConstruido(r);
  assert.deepEqual(h.llamantes, []);
  assert.equal(h.construido, false);
});

// ═════════════════════════════════════════════════ ④ EL FLAG: cuando duda, BLOQUEA

test('SCRUM-1128 · el flag se lee del AST de FLAG_DEFAULTS; solo un `true` literal es ON', () => {
  assert.deepEqual(flagPorDefecto(FLAGS(true)), { leido: true, on: true });
  assert.deepEqual(flagPorDefecto(FLAGS(false)), { leido: true, on: false });
  // Un comentario que dice true no enciende nada.
  assert.deepEqual(flagPorDefecto(`export const FLAG_DEFAULTS = {\n  // ${FLAG_DEL_ENVIO}: true\n  ${FLAG_DEL_ENVIO}: false,\n} as const;`), { leido: true, on: false });
  // Un valor calculado (p. ej. desde el entorno) NO cuenta como ON: el guard no lo puede saber.
  assert.deepEqual(flagPorDefecto(`export const FLAG_DEFAULTS = {\n  ${FLAG_DEL_ENVIO}: process.env.X === '1',\n};`), { leido: true, on: false });
  // Sin la propiedad o sin la tabla: CIEGO, y cuenta como OFF.
  assert.deepEqual(flagPorDefecto('export const FLAG_DEFAULTS = { OTRO: true };'), { leido: false, on: false });
  assert.deepEqual(flagPorDefecto(''), { leido: false, on: false });
});

test('SCRUM-1128 · 🔴 flags.ts ilegible o sin el flag → BLOQUEA aunque haya llamante', () => {
  for (const flags of [null, 'export const OTRA = 1;']) {
    const h = envioConstruido(raiz({ llamante: LLAMANTE, flags }));
    assert.equal(h.flag.leido, false);
    assert.equal(h.construido, false, `flags=${flags}`);
  }
});

test('SCRUM-1128 · 🔴 un ON sólo en el ENTORNO (Railway) no desbloquea la landing', () => {
  const antes = process.env[FLAG_DEL_ENVIO];
  process.env[FLAG_DEL_ENVIO] = 'true';
  try {
    const h = envioConstruido(raiz({ cola: true, llamante: LLAMANTE, flagOn: false }));
    assert.equal(h.construido, false,
      '🔴 el guard obedeció a una variable de entorno: tiene que mirar el valor por defecto del código');
  } finally {
    if (antes === undefined) delete process.env[FLAG_DEL_ENVIO]; else process.env[FLAG_DEL_ENVIO] = antes;
  }
});

// ═════════════════════════════════════════════════ ⑤ EL ÁRBOL REAL

test('SCRUM-1128 · el árbol real: se lee (no está ciego), el flag está en OFF y no hay llamante', () => {
  const h = envioConstruido(RAIZ);
  assert.ok(h.ficherosLeidos > 100, `CIEGO: solo ${h.ficherosLeidos} ficheros .ts en src/`);
  assert.equal(h.flag.leido, true, `CIEGO: no encuentra ${FLAG_DEL_ENVIO} en FLAG_DEFAULTS de src/core/flags.ts`);
  assert.equal(h.flag.on, false);
  assert.deepEqual(h.llamantes, []);
  assert.equal(h.construido, false);
});

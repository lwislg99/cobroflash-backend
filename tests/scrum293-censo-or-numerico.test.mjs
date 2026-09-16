// SCRUM-293 (⑥) · CENSO DERIVADO DEL DEFECTO DE SCRUM-271 EN EL CAMINO DE LA RETENCIÓN.
//
// ──────────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO, QUE NO ES UN DESCUIDO SINO UNA TRAMPA DEL LENGUAJE
//
// `<input type="number">` devuelve **cadena vacía** cuando el navegador rechaza lo tecleado.
// `Number('')` es `0`. Y `0 || <defecto>` da `<defecto>` **en silencio**. Estaba en dos sitios
// (SCRUM-271) y el usuario ve un número distinto del que escribió, sin error y sin aviso.
//
// ⚠️ EL CRITERIO, EXPLÍCITO: un `||` **es correcto** si su defecto significa **lo mismo** que el
// `0` que produce `Number('')`. Si significan cosas distintas, el `||` está tapando una entrada
// inválida con un valor plausible — y eso es el defecto.
//
// Los `||` **booleanos** (encadenar comprobaciones de nulidad) no son de esta familia: no ponen un
// defecto, deciden un camino. Se declaran igual, para que el censo no los redescubra cada vez.
//
// 🔴 UN `||` QUE SOBREVIVE A LA REVISIÓN SE DECLARA AQUÍ CON SU MOTIVO Y DEJA DE SER SOSPECHOSO
// PARA SIEMPRE. Esa es la diferencia entre un censo y una alarma que suena todos los días.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** El camino de la retención: su módulo y todo lo que lee su configuración. */
const CAMINO = [
  'src/modules/invoicing/domain/retencionIrpf.ts',
  'src/modules/invoicing/domain/recargoEquivalencia.ts',
  'src/modules/invoicing/domain/suplidos.ts',
];

/**
 * LOS QUE SOBREVIVEN A LA REVISIÓN, con su motivo. Clave: `fichero:fragmento`, no la línea —
 * un censo anclado a números de línea caduca al primer commit.
 */
const DECLARADOS = {
  'retencionIrpf.ts:params.tipo === null':
    'BOOLEANO, no un defecto. Encadena dos comprobaciones para decidir un camino; no sustituye '
    + 'ningún valor. `Number("")` no interviene.',
  'recargoEquivalencia.ts:base === null':
    'BOOLEANO. Cadena de guardas de nulidad (`null`, `undefined`, cadena vacía, array) para '
    + 'RECHAZAR la entrada, que es lo contrario de taparla con un defecto.',
  'suplidos.ts:Number(linea?.price) || 0':
    'CORRECTO por el criterio: su defecto es `0`, y `Number("")` también es `0`. Los dos '
    + 'significan lo mismo —importe ausente— así que el `||` no cambia nada que el usuario '
    + 'hubiera escrito. ⚠️ Y la cantidad NO usa este patrón: va por `cantidadDeLinea(linea?.qty)`, '
    + 'que es justo donde el defecto SÍ mordía (`0 || 1` daba 1).',
};

/** Todos los `||` del camino que tocan algo numérico. Derivado: nadie los enumera a mano. */
function censo() {
  const out = [];
  let leidos = 0;
  for (const rel of CAMINO) {
    const abs = path.join(RAIZ, rel);
    if (!fs.existsSync(abs)) continue;
    leidos++;
    // ⚠️ Se parte por `/\r?\n/`: los guards hacen `readFileSync` del DISCO, y el disco está en
    // CRLF aunque los blobs estén en LF. Una regex con `$` sin la flag `m` no casaría nunca,
    // porque la línea arrastra el `\r` — y el censo saldría vacío sin que nada chirriara.
    fs.readFileSync(abs, 'utf8').split(/\r?\n/).forEach((l, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(l)) return; // el comentario que lo explica lleva el patrón
      if (!l.includes('||')) return;
      if (!/(Number|parseInt|parseFloat|\.value|qty|price|tipo|percentage|base)/.test(l)) return;
      out.push({ fichero: path.basename(rel), linea: i + 1, texto: l.trim() });
    });
  }
  return { out, leidos };
}

/** La clave declarativa de un hallazgo: fichero + el trozo reconocible de la expresión. */
function clave(h) {
  const frag = Object.keys(DECLARADOS)
    .map((k) => k.split(':').slice(1).join(':'))
    .find((f) => h.texto.includes(f));
  return frag ? `${h.fichero}:${frag}` : null;
}

test('SCRUM-293 · SUELO: el censo LEE ficheros y encuentra algo', () => {
  // Cero hallazgos y «no supe mirar» dan el mismo verde. Y aquí hay un modo de fallo concreto y
  // ya visto: una regex con `$` sin `m` sobre un fichero en CRLF no casa nunca.
  const { out, leidos } = censo();
  assert.equal(leidos, CAMINO.length,
    `🔴 CIEGO: solo se han leído ${leidos} de los ${CAMINO.length} ficheros del camino. `
    + 'Si alguno cambió de sitio, hay que enseñárselo ANTES de fiarse de este archivo.');
  assert.ok(out.length > 0,
    '🔴 CIEGO: el censo no encuentra NINGÚN `||` numérico en el camino de la retención. '
    + 'Sabemos que hay al menos tres: el detector no está mirando.');
});

test('SCRUM-293 · 🔴 todo `||` numérico del camino está REVISADO y declarado', () => {
  const sinDeclarar = censo().out.filter((h) => !clave(h));
  assert.deepEqual(sinDeclarar.map((h) => `${h.fichero}:${h.linea}  ${h.texto.slice(0, 70)}`), [],
    '🔴 HAY UN `||` NUMÉRICO SIN REVISAR EN EL CAMINO DE LA RETENCIÓN.\n\n'
    + '  El criterio: es CORRECTO si su defecto significa lo mismo que el `0` de `Number("")`.\n'
    + '  Si significan cosas distintas, está tapando una entrada inválida con un valor plausible\n'
    + '  — y el usuario ve un número que no escribió, sin error y sin aviso (SCRUM-271).\n\n'
    + '  QUÉ HACER: revísalo y, si sobrevive, declá­ralo en `DECLARADOS` con su motivo. A partir\n'
    + '  de ahí deja de ser sospechoso para siempre: un censo no es una alarma diaria.');
});

test('SCRUM-293 · la lista de declarados no se llena de fantasmas', () => {
  // El otro lado: si un `||` se arregla y nadie lo saca de la lista, la lista deja de describir
  // el código y el siguiente se fía de algo que ya no es cierto.
  const claves = new Set(censo().out.map(clave).filter(Boolean));
  const fantasmas = Object.keys(DECLARADOS).filter((k) => !claves.has(k));
  assert.deepEqual(fantasmas, [],
    `🔴 estas declaraciones ya no corresponden a ningún \`||\`: ${fantasmas.join(', ')}`);
});

test('SCRUM-293 · el módulo de retención NO usa el patrón peligroso', () => {
  // Lo que de verdad importa del ticket: en `retencionIrpf.ts` no hay ni un `|| <número>`. El
  // tipo se valida contra el cubo y lo desconocido se RECHAZA, no se sustituye.
  const src = fs.readFileSync(path.join(RAIZ, CAMINO[0]), 'utf8')
    .split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  assert.ok(!/\|\|\s*\d/.test(src),
    '🔴 `retencionIrpf.ts` ha empezado a poner un número por defecto tras un `||`. Un tipo de '
    + 'retención inventado es peor que ninguno: se emite con una retención que nadie declaró.');
});

// tests/scrum908-la-muda-se-explica.test.mjs — SCRUM-908
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 UNA MUDA QUE NO DICE POR QUÉ OBLIGA A REPRODUCIRLA, Y ESTA NO SE DEJA REPRODUCIR
// ═════════════════════════════════════════════════════════════════════════════════════════════
//
// SCRUM-866 arregló la mutación de `scrum859` y **la dejó a medias**, medido en CI:
//
//     antes del arreglo : 19 de 24 runs con el meta-guard en rojo (era constante)
//     después           : 3 de 38 runs con veredicto completo (≈ 7,9%)
//
// Y no reproduce en local: **50 pasadas sobre los árboles de DOS de los tres runs mudos, cero
// mudas**. Con eso, lo único que quedaba para saber qué pasa era el mensaje del propio
// instrumento — y ese mensaje decía sólo «el guard NO cayó», que tapa cuatro cosas distintas con
// arreglos opuestos. En CI el log **no se puede leer sin credenciales**: lo que no diga el
// mensaje, no lo sabrá nadie.
//
// Esto vigila que el mensaje las distinga. `porQueNoCayo` es PURA para poder ejercitarla aquí en
// milisegundos, sin mutar un solo fichero.
//
// ── LO QUE ESTE FICHERO NO PUEDE DECIR ─────────────────────────────────────────────────────
// 🔴 NO dice que la muda esté arreglada. NO lo está: el criterio de cierre es N pasadas sobre la
//    misma base dando VIVA siempre **en CI**, y eso no se ha conseguido. Esto sólo garantiza que
//    la próxima vez que ocurra, se sepa cuál de las cuatro causas fue.
import test from 'node:test';
import assert from 'node:assert/strict';
import { porQueNoCayo, cayo, paso, esCegueraNoMudez } from '../scripts/meta-guard-mutaciones.mjs';

// ⚠️ MUTACIÓN DECLARADA (SCRUM-745): la ejecuta `npm run meta:mutaciones` en CI. Devuelve el
// diagnóstico a una respuesta única —lo que había antes— y exige el rojo.
export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: "  if ((tras?.pasados || []).some((n) => n.includes(nombre))) return 'PASÓ (corrió y no falló)';",
    a: "  if (true) return 'PASÓ (corrió y no falló)'; // una sola respuesta, a proposito",
    cae: 'SCRUM-908 · 🔴 EL QUE DECIDE: las tres situaciones NO dan la misma respuesta' },
  { fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: "  return /^(SALTADO|NO APARECE)/.test(String(donde));",
    a: '  return false; // SCRUM-1100, mutacion a proposito',
    cae: 'SCRUM-1100 · 🔴 CASO CONOCIDO: sólo "corrió y pasó" es mudez; SALTADO y NO APARECE son ceguera' },
];

const NOMBRE = 'SCRUM-859 · 🔴 insertar una entrada en medio NO mueve ninguna clave';

const conPasado = { pasados: ['otro', NOMBRE], caidos: [], saltados: [] };
const conSaltado = { pasados: ['otro'], caidos: [], saltados: [{ nombre: NOMBRE, motivo: 'QA_DB_TEST' }] };
const ausente = { pasados: ['otro'], caidos: ['otro2'], saltados: [] };

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① SUELO · si las tres entradas fueran equivalentes, lo de abajo pasaría sin medir nada
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-908 · 🔴 SUELO: los tres casos de prueba son de verdad distintos', () => {
  assert.ok(paso(conPasado, NOMBRE), 'el caso «pasó» tiene que tener el test entre los pasados');
  assert.ok(!paso(conSaltado, NOMBRE), 'el caso «saltado» NO puede tener el test entre los pasados');
  assert.ok(!paso(ausente, NOMBRE) && !cayo(ausente, NOMBRE),
    'el caso «ausente» no puede aparecer ni como pasado ni como caído');
  // Y ninguno de los tres CAYÓ: si alguno cayera, no estaríamos en la rama de la muda.
  for (const [n, r] of [['pasado', conPasado], ['saltado', conSaltado], ['ausente', ausente]]) {
    assert.ok(!cayo(r, NOMBRE), `🔴 el caso «${n}» cae, así que no es un caso de MUDA`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② 🔴 EL QUE DECIDE · las tres situaciones NO pueden dar la misma respuesta
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-908 · 🔴 EL QUE DECIDE: las tres situaciones NO dan la misma respuesta', () => {
  const r = [porQueNoCayo(conPasado, NOMBRE), porQueNoCayo(conSaltado, NOMBRE), porQueNoCayo(ausente, NOMBRE)];
  assert.equal(new Set(r).size, 3,
    '🔴 EL DIAGNÓSTICO NO DISTINGUE. Las tres respuestas son:\n  ' + r.join('\n  ')
    + '\n  «corrió y pasó», «no llegó a correr» y «no aparece» tienen arreglos OPUESTOS: el '
    + 'primero es mudez de verdad, el segundo es ceguera y el tercero es un evento perdido. '
    + 'Darles la misma respuesta es volver al «no cayó» que costó este ticket.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ③ ✅ Cada una dice lo suyo, y la de la ceguera lo dice CON ESA PALABRA
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-908 · ✅ cada situación se nombra, y el SALTADO se llama ceguera', () => {
  assert.match(porQueNoCayo(conPasado, NOMBRE), /PAS[ÓO]/);
  assert.match(porQueNoCayo(conSaltado, NOMBRE), /SALTADO/);
  assert.match(porQueNoCayo(conSaltado, NOMBRE), /ceguera/i,
    '🔴 un test que NO CORRIÓ no es un guard mudo: es ceguera, y el mensaje tiene que decirlo '
    + '(es la separación que cerró SCRUM-754c).');
  assert.match(porQueNoCayo(ausente, NOMBRE), /NO APARECE/);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ④ Un resultado que no llega no se inventa una causa
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-908 · sin datos de la pasada, no se afirma que el test pasó', () => {
  for (const vacio of [undefined, null, {}, { pasados: [], caidos: [], saltados: [] }]) {
    assert.match(porQueNoCayo(vacio, NOMBRE), /NO APARECE/,
      '🔴 sin datos se está diciendo que el test «pasó», que es una causa inventada.');
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ⑤ SCRUM-1100 (propuesta de SCRUM-908c §⑦) · SALTADO y NO APARECE cuentan como CEGUERA, no
//    como MUDEZ del guard — hasta hoy las tres causas de arriba producían el MISMO veredicto
//    (`resultado.mudo`), acusando a un guard sano de estar inerte cuando el instrumento no
//    pudo mirar (medido en CI: la mutación nº 2 de `scrum859` pierde su cola de eventos).
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-1100 · 🔴 CASO CONOCIDO: sólo "corrió y pasó" es mudez; SALTADO y NO APARECE son ceguera', () => {
  assert.equal(esCegueraNoMudez(porQueNoCayo(conPasado, NOMBRE)), false,
    '🔴 el test CORRIÓ y PASÓ: el aserto no ve el defecto. Eso SÍ es mudez de verdad.');
  assert.equal(esCegueraNoMudez(porQueNoCayo(conSaltado, NOMBRE)), true,
    '🔴 SALTADO es "no llegó a correr": es ceguera del instrumento, no un guard inerte.');
  assert.equal(esCegueraNoMudez(porQueNoCayo(ausente, NOMBRE)), true,
    '🔴 NO APARECE es un evento perdido (o un fichero muerto a medias): el instrumento no vio, '
    + 'y contarlo como MUDO acusa a un inocente — el defecto exacto de SCRUM-908/908b/908c.');
});

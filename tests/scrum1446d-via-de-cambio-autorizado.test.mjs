// tests/scrum1446d-via-de-cambio-autorizado.test.mjs — SCRUM-1446d
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LA VÍA DE CAMBIO AUTORIZADO DE `scrum603b` Y `scrum723`, Y LO QUE SIGUE CAYENDO
//
// Decisión del fundador: SCRUM-1446 c.20473, «Sí, abrir la vía» (opción A de c.18901). La vía vive
// en `tests/_cambios-autorizados-de-la-factura.mjs`. Aquí se prueba que es un MECANISMO y no un
// agujero (regla 41):
//   ① con un PAR sembrado por el propio test, el cambio declarado pasa; y quitándolo, no;
//   ② el cambio declarado con un byte de más, sobre otra base, o en el otro trozo, NO pasa;
//   ③ cada entrada real lleva una firma LOCALIZABLE: `SCRUM-N c.M`, y su registro
//      `docs/master/SCRUM-N.md` contiene ese comentario y la cita literal.
// Los dos guards de verdad, con el cambio puesto, se ven en sus propios ficheros.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAMBIOS_AUTORIZADOS, cambioAutorizado, huella } from './_cambios-autorizados-de-la-factura.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// El positivo se SIEMBRA aquí: no depende de ningún cambio real del árbol, que un día entra en
// `main` y deja de ser un cambio.
const ANTES = 'export async function generateInvoicePdf(x) {\n  doc.text(`${(t*100).toFixed(0)}%`);\n}\n';
const DESPUES = 'export async function generateInvoicePdf(x) {\n  doc.text(`${rotuloDeTipo(t)}%`);\n}\n';
const SEMBRADA = [{
  firma: 'SCRUM-0 c.0', registro: 'no-existe', cita: 'sembrada',
  cuerpo: { de: huella(ANTES), a: huella(DESPUES) },
}];

test('SCRUM-1446d · ① el par sembrado pasa, y sin él NO (el positivo puede decir que no)', () => {
  assert.equal(cambioAutorizado('cuerpo', ANTES, DESPUES, SEMBRADA), SEMBRADA[0],
    '🔴 el cambio declarado no pasa: la vía está cerrada y el test no mide nada');
  assert.equal(cambioAutorizado('cuerpo', ANTES, DESPUES, []), null,
    '🔴 CIEGO: sin ninguna declaración el cambio también pasa — la vía lo deja pasar todo');
  // Y la lista REAL no autoriza el cambio sembrado: no hay comodín.
  assert.equal(cambioAutorizado('cuerpo', ANTES, DESPUES), null,
    '🔴 la lista real autoriza un cambio que nadie declaró en ella');
});

test('SCRUM-1446d · ② 🔴 lo que sigue cayendo: un byte de más, otra base, otro trozo', () => {
  assert.equal(cambioAutorizado('cuerpo', ANTES, DESPUES + ' ', SEMBRADA), null,
    '🔴 el cambio autorizado MÁS un byte pasa: la firma cubriría cualquier cosa');
  assert.equal(cambioAutorizado('cuerpo', ANTES + ' ', DESPUES, SEMBRADA), null,
    '🔴 el mismo cambio sobre OTRA base pasa: si main tocó la factura entretanto, hay que volver a pedirlo');
  assert.equal(cambioAutorizado('ambito', ANTES, DESPUES, SEMBRADA), null,
    '🔴 un par declarado para el cuerpo autoriza el ámbito: son dos comparaciones distintas');
  assert.equal(cambioAutorizado('cuerpo', DESPUES, ANTES, SEMBRADA), null,
    '🔴 el par autoriza también la vuelta atrás');
  // Lo único que la huella ignora es el fin de línea de Windows.
  assert.equal(cambioAutorizado('cuerpo', ANTES.replace(/\n/g, '\r\n'), DESPUES, SEMBRADA), SEMBRADA[0],
    '🔴 un CRLF de Windows cambia la huella: en local y en CI saldrían distintas');
});

test('SCRUM-1446d · ③ cada cambio autorizado lleva una firma LOCALIZABLE', () => {
  assert.ok(CAMBIOS_AUTORIZADOS.length >= 1, '🔴 SUELO: la lista de cambios autorizados está vacía');
  for (const c of CAMBIOS_AUTORIZADOS) {
    const m = /^SCRUM-(\d+) c\.(\d+)$/.exec(c.firma ?? '');
    assert.ok(m, `🔴 firma sin forma «SCRUM-N c.M»: ${c.firma}`);
    assert.equal(c.registro, `docs/master/SCRUM-${m[1]}.md`,
      `🔴 ${c.firma}: el registro tiene que ser el del ticket que firma`);
    const p = path.join(RAIZ, c.registro);
    assert.ok(fs.existsSync(p), `🔴 ${c.firma}: no existe ${c.registro}`);
    const txt = fs.readFileSync(p, 'utf8');
    assert.ok(txt.includes(`c.${m[2]}`), `🔴 ${c.firma}: ${c.registro} no nombra el comentario c.${m[2]}`);
    assert.ok(typeof c.cita === 'string' && c.cita.length >= 5 && txt.includes(c.cita),
      `🔴 ${c.firma}: la cita «${c.cita}» no está LITERAL en ${c.registro}`);
    const trozos = ['cuerpo', 'ambito'].filter((k) => c[k]);
    assert.ok(trozos.length >= 1, `🔴 ${c.firma}: no declara ningún par`);
    for (const k of trozos) {
      assert.match(c[k].de, /^[0-9a-f]{64}$/, `🔴 ${c.firma}: ${k}.de no es una huella`);
      assert.match(c[k].a, /^[0-9a-f]{64}$/, `🔴 ${c.firma}: ${k}.a no es una huella`);
      assert.notEqual(c[k].de, c[k].a, `🔴 ${c.firma}: ${k} declara un cambio que no cambia nada`);
    }
  }
});

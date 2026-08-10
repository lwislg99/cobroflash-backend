// tests/scrum324-aviso-simplificado-ui.test.mjs — SCRUM-324 (E3)
//
// LA MICROCOPY FISCAL ES LA APROBADA, Y EL AVISO NO SALTA CUANDO NO SABE.
//
// ── POR QUÉ ESTE GUARD Y NO SOLO EL DEL DOMINIO ─────────────────────────────────────────────
// El dominio (`justificante.ts`) decide bien y está probado. Pero lo que le llega a un profesional
// es la FRASE, y esa frase le dice qué puede y qué no puede deducirse: un texto fiscal mal escrito
// no es feo, es peligroso. La regla 30 no admite parafrasear microcopy oficial, y aquí menos.
//
// ── LA FRASE, Y POR QUÉ ES ESA ──────────────────────────────────────────────────────────────
// Se eligió sobre otras tres, y el motivo queda escrito porque quien venga a «mejorarla» tiene que
// saber qué se descartó:
//
//   · «no puedes deducir este gasto» → FALSA POR EXCESO. Un ticket sí puede ser gasto deducible en
//     IRPF en estimación directa: es otra cosa y otro importe.
//   · «para que tu asesor pueda usar este gasto» → esconde lo que está en juego. Lo que se pierde
//     es EL IVA, que es dinero del profesional y es cuantificable; tiene derecho a saberlo.
//
// Sin gate: lee el fichero de la vista. Vanilla, sin navegador.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const VISTA = path.join(RAIZ, 'public/dashboard/js/expensesView.js');

/** Literal, carácter a carácter. Aprobada por el fundador el 10-ago-2026. */
const TEXTO_APROBADO = 'Con un ticket no puedes deducir el IVA. Pide en el almacén una '
  + 'factura a tu nombre, con tu NIF y el IVA desglosado.';

function vista() {
  try {
    return fs.readFileSync(VISTA, 'utf8');
  } catch (e) {
    assert.fail(
      `🔴 no se pudo leer ${VISTA} (${e && e.code ? e.code : e}).\n\n`
      + '  «La microcopy es la aprobada» y «no supe leer la vista» son el mismo verde.');
  }
}

test('SCRUM-324 · la microcopy del aviso es EXACTAMENTE la aprobada', () => {
  const s = vista();
  // Se busca el texto ya concatenado, para que partirlo en dos líneas no lo escape del guard.
  const literales = [...s.matchAll(/'([^'\\]*(?:\\.[^'\\]*)*)'/g)].map((m) => m[1]);
  const unido = literales.join('');
  assert.ok(
    unido.includes(TEXTO_APROBADO),
    '🔴 EL AVISO DEL SIMPLIFICADO NO DICE LA FRASE APROBADA.\n\n'
    + `  Debe decir, literal:\n    «${TEXTO_APROBADO}»\n\n`
    + '  No se parafrasea (regla 30). Y ojo con las dos versiones que se DESCARTARON:\n'
    + '    · «no puedes deducir este gasto» es FALSO POR EXCESO — un ticket sí puede ser gasto\n'
    + '      deducible en IRPF en estimación directa.\n'
    + '    · «para que tu asesor pueda usar este gasto» esconde que lo que se pierde es EL IVA,\n'
    + '      que es dinero del profesional y es cuantificable.');
});

test('SCRUM-324 · el aviso solo salta con `no_deducible`, nunca con `falta_confirmar`', () => {
  // 🔴 ES LA MITAD QUE HACE ÚTIL AL AVISO. `falta_confirmar` significa «todo lo comprobable está y
  // solo queda mirar el papel»: avisar ahí es acusar sin saber, y un aviso que salta siempre se
  // aprende a ignorar exactamente igual que uno que no salta nunca.
  const s = vista();
  const condicion = /justificante\?\.veredicto === 'no_deducible'/.test(s);
  assert.ok(condicion,
    '🔴 el aviso ya no está condicionado a `no_deducible`. Si salta con `falta_confirmar` estamos '
    + 'acusando sin saber; si salta siempre, hemos construido ruido.');
  assert.ok(
    !/veredicto === 'falta_confirmar'[\s\S]{0,200}AVISO_SIMPLIFICADO/.test(s),
    '🔴 `falta_confirmar` está pintando el aviso del simplificado');
});

test('SCRUM-324 · los TRES campos del momento están en el formulario', () => {
  const s = vista();
  const exigidos = [
    ['exp-amount', 'el importe total'],
    ['exp-date', 'la fecha'],
    ['exp-provider-nif', 'el NIF del proveedor'],
  ];
  const faltan = exigidos.filter(([id]) => !s.includes(`id="${id}"`)).map(([, q]) => q);
  assert.deepEqual(
    faltan, [],
    '🔴 FALTA UNO DE LOS TRES CAMPOS DEL MOMENTO: ' + faltan.join(', ')
    + '\n\n  Son los tres que caben en diez segundos de pie en un almacén. Sin el NIF del proveedor\n'
    + '  el justificante no puede deducir IVA nunca, y el aviso sería un misterio en vez de una\n'
    + '  instrucción.');
});

test('SCRUM-324 · el NIF viaja al servidor, no se queda en la pantalla', () => {
  // Un campo que se pinta y no se envía es exactamente el botón que se traga los datos de
  // SCRUM-370: indistinguible, desde fuera, de uno que funciona.
  const s = vista();
  assert.match(s, /nifProveedor:\s*document\.getElementById\('exp-provider-nif'\)/,
    '🔴 el NIF se captura pero no se manda en el payload: es un campo que se traga lo que se teclea');
});

test('SCRUM-324 · SUELO: el guard mira una vista que de verdad tiene el formulario', () => {
  // Sin esto, renombrar el fichero o vaciarlo dejaría todos los asserts de arriba pasando sobre
  // una cadena vacía —o sobre otra pantalla— y «la microcopy es correcta» no significaría nada.
  const s = vista();
  assert.ok(s.length > 5000, `🔴 la vista tiene ${s.length} caracteres: no es el formulario de gastos`);
  assert.match(s, /id="exp-modal"|exp-modal/, '🔴 esto no es la vista del modal de gasto');
});

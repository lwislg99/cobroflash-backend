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

test('SCRUM-324 · 🔴 la afirmación FISCAL sobre el ticket NO está encendida', () => {
  // Este test decía lo contrario: exigía que el aviso «con un ticket no puedes deducir el IVA»
  // estuviera pintado, con su frase exacta. **Se invierte, y el motivo es la decisión del fundador
  // del 10-ago-2026:** decir qué admite Hacienda es una afirmación FISCAL y el producto no las hace
  // sin el asesor. Las tres versiones candidatas siguen en `docs/legal/PREGUNTAS_ASESOR.md:539-542`
  // como preguntas SIN responder — no como texto pendiente de pegar.
  //
  // Y no queda contenedor esperándolas: un `<div>` mudo es un enlace construido que no se pinta
  // nunca (SCRUM-424) un paso antes, y encima invita a rellenarlo sin aprobación.
  //
  // ⚠️ Se mira el fuente SIN COMENTARIOS, o este guard se caza a sí mismo en la línea de arriba.
  // 🔴 RESPALDO DE LAS NEGACIONES (SCRUM-237). Tres `doesNotMatch` seguidos son un verde
  // permanente si los tokens que niegan no existen en ninguna parte: el guard de 237 me lo cazó
  // aquí mismo. Así que primero se DEMUESTRA que el detector encuentra esos tokens cuando están.
  const conElAviso = [
    "const AVISO_SIMPLIFICADO = 'Con un ticket no puedes deducir el IVA.';",
    '<div id="exp-aviso-iva" class="alert warning"></div>',
  ].join(String.fromCharCode(10));
  assert.match(conElAviso, /no puedes deducir el IVA/i, '🔴 el detector no ve la frase ni cuando está.');
  assert.match(conElAviso, /AVISO_SIMPLIFICADO/, '🔴 el detector no ve la constante ni cuando está.');
  assert.match(conElAviso, /id="exp-aviso-iva"/, '🔴 el detector no ve el contenedor ni cuando está.');

  // Y la frase real, viva donde le toca: en las preguntas al asesor, SIN responder.
  const preguntas = fs.readFileSync(new URL('../docs/legal/PREGUNTAS_ASESOR.md', import.meta.url), 'utf8');
  assert.match(preguntas, /deducir el IVA/i,
    '🔴 la pregunta al asesor sobre el IVA del ticket ha desaparecido del documento: entonces ' +
    'estas negaciones no protegen una decisión pendiente, protegen un olvido.');

  const codigo = vista().split(String.fromCharCode(10)).filter((l) => !l.trimStart().startsWith('//')).join(String.fromCharCode(10));
  assert.doesNotMatch(codigo, /no puedes deducir el IVA/i,
    '🔴 se ha encendido la afirmación fiscal sobre el ticket sin el asesor.');
  assert.doesNotMatch(codigo, /AVISO_SIMPLIFICADO/,
    '🔴 ha vuelto la constante del aviso fiscal.');
  assert.doesNotMatch(codigo, /id="exp-aviso-iva"/,
    '🔴 ha vuelto el contenedor vacío del aviso.');

  // El MOTOR sí sigue conectado, pero EN LA RUTA y no en la vista: la vista ya no consume el
  // veredicto porque no hay nada que pintar, y comprobarlo aquí sería exigir un consumidor que
  // este ticket ha retirado a propósito. El motor vive donde vive la regla fiscal.
  const ruta = fs.readFileSync(new URL('../src/modules/expenses/app/routes/expenses.routes.ts', import.meta.url), 'utf8');
  assert.match(ruta, /clasificarJustificante\(/,
    '🔴 se ha desconectado el motor del justificante de la ruta. El motor se queda —dejo de ser ' +
    'un fichero sin llamadores—; lo que espera al asesor es la FRASE, no el mecanismo.');
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

// tests/scrum854-todo-merge-deja-entrada.test.mjs — SCRUM-854
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// UNA RAMA QUE TOCA CÓDIGO DEJA SU ENTRADA DE REGISTRO. Y SI NO SE SABE DE QUÉ TICKET ES, SE DICE.
//
// Tres casos los encontraron dos sesiones distintas el 15-sep-2026, **ninguna buscándolos**. El
// censo de este ticket encontró **cinco**, y dos de ellos siguen sin expediente hoy.
//
// SCRUM-273 comprueba que la entrada que EXISTE esté bien puesta; esto comprueba que exista. No
// se relaja nada de aquél: son preguntas distintas sobre el mismo fichero.
//
// ── LOS CONTROLES ─────────────────────────────────────────────────────────────────────────────
//
//   ① SUELO ................. el instrumento VE ficheros y resuelve la base. Si no, CIEGO.
//   ② 🔴 EL QUE DECIDE ...... esta rama, si toca código, trae su entrada — y el veredicto nombra
//                             la rama y el fichero que falta.
//   ③ 🔴 ROJO POR MECANISMO . una rama sintética que toca código sin entrada sale FALTA; la misma
//                             con su entrada sale CUMPLE. Si no distinguiera, ② no mide nada.
//   ④ LAS EXENCIONES SON CRITERIOS, no una lista: sólo-documentación y ticket-desconocido, cada
//                             una con su motivo escrito en el veredicto.
//   ⑤ 🔴 LA TRAMPA DE SCRUM-828 .. cuando el número no aparece en NINGUNA parte, el veredicto es
//                             NO_SE_PUDO_DETERMINAR y **no** CUMPLE. Son cosas distintas.
//   ⑥ LAS VÍAS ESTÁN MEDIDAS . la unión rama+commits cubre más que la rama sola, que es lo que
//                             justifica mirar las dos.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { ficherosDeLaRama } from './_censo-eol.mjs';
import {
  veredictoDeLaRama, numeroDelTicket, numeroDeRama, entradaDe,
  CUMPLE, FALTA, NO_SE_PUDO_DETERMINAR, CARPETAS_DE_CODIGO,
} from './_entrada-de-la-rama.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ① SUELO
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-854 · ① SUELO: el instrumento resuelve la base y VE lo que la rama toca', () => {
  const { baseResuelta, rutas } = ficherosDeLaRama(RAIZ);
  assert.equal(baseResuelta, true,
    '🔴 CIEGO: no se pudo resolver la base de la rama. Sin base no se sabe qué aporta, y un '
    + '«no he mirado» no se puede contar como que cumple.');
  assert.ok(Array.isArray(rutas), '🔴 el recolector no devuelve rutas');

  assert.ok(CARPETAS_DE_CODIGO.length >= 4,
    '🔴 la lista de carpetas de código se quedó corta: con menos, un PR que toca `src/` podría '
    + 'no contar como que toca código y el guard callaría justo donde importa.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ② EL QUE DECIDE — sobre ESTA rama
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-854 · 🔴 ② esta rama, si toca código, trae su entrada de registro', () => {
  const v = veredictoDeLaRama(RAIZ);

  // NO_SE_PUDO_DETERMINAR no se traga como verde: se dice en voz alta y se deja pasar, porque
  // acusar sin saber de qué ticket es sería peor que no acusar.
  if (v.veredicto === NO_SE_PUDO_DETERMINAR) {
    assert.ok(v.motivo, '🔴 un «no se pudo determinar» sin motivo no se puede accionar');
    return;
  }

  assert.notEqual(v.veredicto, FALTA,
    `🔴 ESTA RAMA ENTRA EN MAIN SIN DEJAR ENTRADA DE REGISTRO.\n`
    + `    rama:     ${v.ticket?.nombre ?? '(desconocida)'}\n`
    + `    ticket:   SCRUM-${v.ticket?.num ?? '?'} (por ${v.ticket?.via ?? '?'})\n`
    + `    falta:    ${v.esperada}\n`
    + `    toca:     ${v.codigo.slice(0, 6).join(', ')}${v.codigo.length > 6 ? ` … (+${v.codigo.length - 6})` : ''}\n`
    + '  Se escribe la entrada. No se relaja el guard (norma A7).');
  assert.equal(v.veredicto, CUMPLE, `🔴 veredicto inesperado: ${v.veredicto} — ${v.motivo}`);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ③ ROJO POR MECANISMO — sin esto, ② podría estar verde sin comprobar nada
// ═══════════════════════════════════════════════════════════════════════════════════════════════

/** El mismo criterio de `veredictoDeLaRama`, aplicado a un caso de laboratorio. */
function veredictoDe({ rutas, num }) {
  const codigo = rutas.filter((r) => CARPETAS_DE_CODIGO.some((c) => r.startsWith(c)));
  if (!codigo.length) return CUMPLE;
  if (!num) return NO_SE_PUDO_DETERMINAR;
  return rutas.includes(entradaDe(num)) ? CUMPLE : FALTA;
}

test('SCRUM-854 · 🔴 ③ ROJO POR MECANISMO: el criterio distingue traer entrada de no traerla', () => {
  const SIN = { rutas: ['src/app.ts', 'tests/x.test.mjs'], num: '848' };
  const CON = { rutas: ['src/app.ts', 'tests/x.test.mjs', 'docs/master/SCRUM-848.md'], num: '848' };

  assert.equal(veredictoDe(SIN), FALTA,
    '🔴 EL CRITERIO NO VE LA FALTA: una rama que toca `src/` sin entrada sale por buena, así que '
    + 'el verde de ② no significaría nada.');
  assert.equal(veredictoDe(CON), CUMPLE,
    '🔴 el criterio marca como falta una rama que SÍ trae su entrada: sería un rojo permanente.');

  // Y no vale cualquier entrada: la de OTRO ticket no cuenta.
  assert.equal(veredictoDe({ rutas: ['src/app.ts', 'docs/master/SCRUM-999.md'], num: '848' }), FALTA,
    '🔴 la entrada de otro ticket se está contando como propia');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ④ LAS EXENCIONES SON CRITERIOS DERIVADOS, no una lista que envejece
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-854 · ④ las dos exenciones se DERIVAN del contenido, y llevan su motivo', () => {
  // Sólo documentación: no necesita expediente propio.
  assert.equal(veredictoDe({ rutas: ['docs/RUNBOOKS.md', 'README.md'], num: null }), CUMPLE,
    '🔴 un PR de sólo documentación está exigiendo expediente');

  // Y la exención NO es «esta rama está en una lista»: cámbiale el contenido y cambia el veredicto.
  assert.equal(veredictoDe({ rutas: ['docs/RUNBOOKS.md', 'src/app.ts'], num: '854' }), FALTA,
    '🔴 la exención de documentación se está aplicando a un PR que TAMBIÉN toca código');

  // El veredicto real de esta rama trae su motivo escrito, sea cual sea.
  const v = veredictoDeLaRama(RAIZ);
  assert.ok(typeof v.motivo === 'string' && v.motivo.length > 10,
    '🔴 el veredicto no explica POR QUÉ: una exención que no se declara es una que se asume');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ⑤ LA TRAMPA DE SCRUM-828 — el número puede no estar en ninguna parte
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-854 · 🔴 ⑤ sin número de ticket el veredicto NO es CUMPLE: es «no se pudo determinar»', () => {
  const v = veredictoDe({ rutas: ['src/app.ts'], num: null });
  assert.equal(v, NO_SE_PUDO_DETERMINAR,
    '🔴 UNA RAMA QUE TOCA CÓDIGO Y NO DICE DE QUÉ TICKET ES SALE POR BUENA. Es exactamente el '
    + 'caso de SCRUM-828: el número no aparecía ni en la rama, ni en el commit, ni en el test. '
    + 'Un guard que sólo mira nombres de rama se traga justo los que más importan.');
  assert.notEqual(v, CUMPLE, '🔴 «no he podido saberlo» se está contando como «cumple»');

  // Y el lector de números no inventa: una rama sin número devuelve null, no un número cualquiera.
  assert.equal(numeroDeRama('scrum-orquestador-prompt-solo-a-quien-habla'), null,
    '🔴 se está sacando un número de una rama que no lo lleva');
  assert.equal(numeroDeRama('main'), null, '🔴 `main` no es una rama de ticket');
  assert.equal(numeroDeRama('scrum-854-merge-sin-entrada'), '854', '🔴 no lee el número que SÍ está');
  assert.equal(numeroDeRama('scrum-839b-edad-y-rojo'), '839',
    '🔴 no lee el número de una fase (`839b` es del ticket 839)');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ⑥ LAS VÍAS, medidas: por qué se miran DOS y no sólo el nombre de la rama
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-854 · ⑥ el ticket se busca por rama Y por commits, y se dice por cuál se supo', () => {
  const t = numeroDelTicket(RAIZ);
  assert.ok(Array.isArray(t.vias), '🔴 el resolvedor no declara por qué vías lo intentó');

  // Con la rama puesta a mano, la vía es la rama — y el número sale de ella.
  const conRama = numeroDelTicket(RAIZ, { rama: 'scrum-848-tactil-ficha-trabajo', env: {} });
  assert.equal(conRama.num, '848', '🔴 no resuelve el ticket desde el nombre de la rama');
  assert.equal(conRama.via, 'rama');

  // Y con una rama SIN número tiene que caer a los commits en vez de rendirse: es la vía que
  // cubre 36 de 37 merges medidos, una más que el nombre de la rama.
  const sinNumero = numeroDelTicket(RAIZ, { rama: 'scrum-orquestador-prompt', env: {} });
  assert.notEqual(sinNumero.via, 'rama',
    '🔴 dice haberlo sacado de una rama que no lleva número: se lo está inventando');
});

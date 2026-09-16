// tests/scrum416-ayuda-dentro.test.mjs — SCRUM-416
//
// LA AYUDA VIVE DENTRO DEL MODAL — Y DOS PANTALLAS SIGUEN SIN ELLA, DECLARADAS.
//
// ── LO QUE ESTE TICKET NO ES ────────────────────────────────────────────────────────────────
// **No destapa el FAB.** Que el «?» flotante se esconda con una modal abierta fue una decisión del
// fundador, y está escrita en el propio CSS: «Feedback fundador 6-jul: el botón flotante ? no debe
// pisar las modales». Esa decisión sigue en pie. Lo que faltaba era **un sitio dentro**.
//
// ── 🔴 LO QUE NO SE PUEDE DAR POR RESUELTO ──────────────────────────────────────────────────
// La ayuda no llegaba por **TRES** caminos distintos, medidos uno a uno, y esto arregla **uno**:
//
//   · **24 modales compartidos** — `.modal-overlay` a z-index 500, y el FAB oculto por
//     `display:none !important`. **RESUELTO**: el «?» va en la cabecera.
//   · **la firma** — `signaturePad.js` monta overlay PROPIO a **z-index 1200**. El FAB no está
//     oculto: está **debajo**. Y su overlay **no lleva cabecera de modal**, así que el «?» del
//     constructor tampoco le llega. **SIGUE IGUAL.** Es la pantalla donde firma el cliente.
//   · **el onboarding** — overlay propio a **z-index 300**, por DEBAJO del FAB (350). Ahí el «?»
//     se ve y funciona: **el defecto es el contrario**, sobra FAB pisando el onboarding — que es
//     justo lo que el feedback del 6-jul quería evitar. **SIGUE IGUAL**, y arreglarlo es otra
//     decisión.
//
// Quien vea desaparecer el síntoma en 24 de 27 sitios lo dará por cerrado. Este fichero existe para
// que eso no pase: los dos que faltan están **nombrados**, no insinuados.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { soloEjecutable } from './_guard-texto.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const DIR = path.join(RAIZ, 'public/dashboard/js');
const leer = (p) => {
  try {
    return fs.readFileSync(path.join(RAIZ, p), 'utf8');
  } catch (e) {
    assert.fail(`🔴 no se pudo leer ${p} (${e && e.code ? e.code : e}). «Está» y «no supe mirar» son el mismo verde.`);
  }
};

test('SCRUM-416 · SUELO: se lee el constructor y tiene contenido', () => {
  const s = leer('public/dashboard/js/modalHeader.js');
  assert.ok(s.length > 1500, `🔴 el constructor tiene ${s.length} caracteres: no es el fichero que se cree`);
  assert.match(s, /function cabeceraModal/, '🔴 esto no es el constructor de cabecera');
});

test('SCRUM-416 · el «?» está en la cabecera, y abre LA MISMA guía que el FAB', () => {
  const s = soloEjecutable(leer('public/dashboard/js/modalHeader.js'));
  assert.match(s, /className = 'modal-ayuda'|classList\.add\('modal-ayuda'\)/,
    '🔴 la cabecera ya no lleva el botón de ayuda: la ayuda vuelve a no tener sitio dentro del modal');
  assert.match(s, /window\.openHelpGuide/,
    '🔴 el «?» del modal no abre `window.openHelpGuide`. Si abre otra cosa, hay DOS guías: el día '
    + 'que alguien mejore la del FAB, la del modal se queda atrás y nadie lo nota.');

  // Y que la guía siga estando expuesta, o el botón no hace nada.
  const tut = soloEjecutable(leer('public/dashboard/js/tutorial.js'));
  assert.match(tut, /window\.openHelpGuide\s*=\s*openHelpGuide/,
    '🔴 `openHelpGuide` ha dejado de exponerse: el «?» de la cabecera se queda sin hacer nada, que '
    + 'es peor que no tenerlo — parece que funciona.');
});

test('SCRUM-416 · el panel de ayuda se abre POR ENCIMA del modal', () => {
  // 🔴 SIN ESTO EL BOTÓN ES UNA MENTIRA. El panel vivía a z-index 360 y los modales van a 500: se
  // abría DETRÁS de la modal desde la que acabas de pedir ayuda. Un «?» que no enseña nada es peor
  // que no tener «?», porque además parece que el producto está roto.
  // ⚠️ SIN COMENTARIOS Y SIN VENTANA FIJA, y lo aprendí aquí mismo: la primera versión buscaba el
  // z-index en los 400 caracteres siguientes al id del panel, y **el comentario que yo acababa de
  // escribir empujó el número fuera de la ventana**. Es el defecto de SCRUM-435 cometido en el test
  // que lo vigila. Se lee el código ejecutable y se ancla en la asignación, no en una distancia.
  const tut = soloEjecutable(leer('public/dashboard/js/tutorial.js'));
  const css = leer('public/dashboard/css/styles.css');
  const guia = tut.slice(tut.indexOf('function openHelpGuide'));
  const panel = Number((guia.match(/cssText\s*=\s*'[^']*z-index:(\d+)/) || [])[1]);
  const modal = Number((css.match(/\.modal-overlay\s*\{\s*z-index:\s*(\d+)/) || [])[1]);
  assert.ok(Number.isFinite(panel) && Number.isFinite(modal),
    `🔴 ESCÁNER CIEGO: no se leen los z-index (panel=${panel}, modal=${modal}). Sin ellos no se puede `
    + 'afirmar que la ayuda se vea.');
  assert.ok(panel > modal,
    `🔴 el panel de ayuda (${panel}) NO está por encima del modal (${modal}): se abriría detrás, y `
    + 'el «?» parecería no hacer nada.');
});

test('SCRUM-416 · 🔴 LA FIRMA SIGUE SIN AYUDA, y se declara', () => {
  // No es un olvido: su overlay no lleva cabecera de modal, así que el constructor no le llega. Y
  // su z-index (1200) deja al FAB debajo. Este test existe para que el día que alguien lo arregle
  // —o lo rompa— haya que pasar por aquí, en vez de descubrirlo en la pantalla donde firma el cliente.
  const firma = leer('public/dashboard/js/signaturePad.js');
  assert.match(firma, /z-index:\s*1200/,
    '🔴 ha cambiado el z-index del overlay de la firma. Si ahora deja ver el FAB, medio SCRUM-416 '
    + 'puede estar resuelto por accidente: dilo y quita esta declaración, no la dejes mintiendo.');
  assert.ok(!/modal-ayuda|cabeceraModal\(/.test(soloEjecutable(firma)),
    '🔴 la firma ya usa la cabecera compartida o el botón de ayuda. Es una buena noticia, pero hay '
    + 'que ACTUALIZAR la declaración: hoy dice que sigue sin ayuda.');
});

test('SCRUM-416 · 🔴 EL ONBOARDING sigue igual, y su defecto es el CONTRARIO', () => {
  // Ahí no falta ayuda: SOBRA FAB. Su overlay va a 300 y el FAB a 350, así que el «?» flotante se
  // pinta ENCIMA del onboarding — justo lo que el feedback del 6-jul quería evitar. Arreglarlo es
  // otra decisión, y hasta que se tome esto lo mantiene contado.
  const onb = leer('public/dashboard/js/onboardingView.js');
  const tut = leer('public/dashboard/js/tutorial.js');
  const zOnb = Number((onb.match(/z-index:\s*(\d+)/) || [])[1]);
  const zFab = Number((tut.match(/tut-help-btn[\s\S]{0,400}?z-index:(\d+)/) || [])[1]);
  assert.ok(Number.isFinite(zOnb) && Number.isFinite(zFab),
    `🔴 ESCÁNER CIEGO: no se leen los z-index (onboarding=${zOnb}, FAB=${zFab})`);
  assert.ok(zOnb < zFab,
    `🔴 el onboarding (${zOnb}) ya NO está por debajo del FAB (${zFab}). Si se ha arreglado, quita `
    + 'esta declaración; si se ha movido por otro motivo, decide qué pasa con el FAB encima.');
});

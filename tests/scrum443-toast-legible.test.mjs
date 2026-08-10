// tests/scrum443-toast-legible.test.mjs — SCRUM-443
//
// UN ERROR QUE SE VA POR LA MITAD.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LO MEDIDO (SCRUM-405, 10-ago-2026) Y QUE NO HAY QUE VOLVER A MEDIR
//
//   · los errores duraban 5.000 ms FIJOS;
//   · el mensaje de error más largo del producto son 136 caracteres ≈ 7,5 s de lectura;
//   · `showToast` no registraba listener, no pintaba cierre y no tenía `cursor:pointer`;
//   · `border-radius: 999px`, pensado para una línea.
//
// O sea: había errores que desaparecían antes de poder leerse, y el profesional no podía ni
// recuperarlos ni pararlos. Se quedaba sabiendo que algo falló y sin saber qué.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 ESTE FICHERO FIJA EL MOTIVO, NO EL NÚMERO
//
// Un test que dijera «la duración es 10.000» se pasa con un `10000` y vuelve a romperse el día que
// alguien escriba un mensaje de 200 caracteres — **que es exactamente cómo llegamos aquí**: el 5
// fijo se puso cuando los mensajes eran cortos, y nadie volvió a mirarlo cuando dejaron de serlo.
//
// Así que lo que se afirma es la RELACIÓN: **todo mensaje de error tiene que caber en su propia
// duración**. Y el guard recorre los mensajes REALES del árbol, así que un mensaje nuevo y más
// largo entra solo en la comprobación.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_JS = path.join(RAIZ, 'public/dashboard/js');

/** Velocidad de lectura de referencia: ~3,3 palabras/s a ~5,5 car/palabra ≈ 18 car/s. */
const CAR_POR_SEGUNDO = 18;
const msDeLectura = (texto) => (texto.length / CAR_POR_SEGUNDO) * 1000;

/** Todos los `showToast('literal', 'kind')` del árbol, con su tipo. */
function censoDeToasts() {
  const salida = [];
  for (const f of fs.readdirSync(DIR_JS).filter((x) => x.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(DIR_JS, f), 'utf8');
    for (const m of src.matchAll(/showToast\(\s*'([^']*)'\s*(?:,\s*'(ok|warn|error)')?/g)) {
      salida.push({ fichero: f, texto: m[1], kind: m[2] || 'ok' });
    }
  }
  return salida;
}

const banco = cargarDashboard(RAIZ);
const duracion = banco.ctx.duracionToast;

// ── SUELO ────────────────────────────────────────────────────────────────────────────────

test('SCRUM-443 · 🔴 SUELO: sin toasts que medir, esto se declara CIEGO', () => {
  const censo = censoDeToasts();
  assert.ok(censo.length >= 20,
    `🔴 el censo encontró ${censo.length} toasts. Con tan pocos, «todos caben» no significa nada: ` +
    'el escáner ha dejado de ver la mayoría y estaría dando un verde sobre casi ningún mensaje.');
  assert.ok(censo.some((t) => t.kind === 'error'),
    '🔴 no se ha encontrado NI UN toast de error, que es justo la población que este guard vigila.');
  assert.equal(typeof duracion, 'function', '🔴 `duracionToast` no está publicada: nada que medir.');
});

// ── EL POSITIVO ──────────────────────────────────────────────────────────────────────────

test('SCRUM-443 · ✅ TODO mensaje de error cabe en su propia duración', () => {
  // La afirmación que fija el motivo. No hay número escrito aquí: se compara cada mensaje real
  // contra el tiempo que el producto le da.
  const errores = censoDeToasts().filter((t) => t.kind === 'error');
  const cortos = [];
  for (const t of errores) {
    const dan = duracion(t.texto, 'error');
    const necesita = msDeLectura(t.texto);
    if (dan < necesita) cortos.push({ ...t, dan, necesita });
  }
  assert.deepEqual(cortos.map((c) => `${c.fichero}: ${c.texto.length} car`), [],
    '🔴 HAY ERRORES QUE SE VAN ANTES DE PODER LEERSE:\n\n' +
    cortos.map((c) => `   · ${c.fichero} — ${c.texto.length} car · se le dan ${c.dan} ms y necesita ` +
      `~${Math.round(c.necesita)} ms (le faltan ${Math.round(c.necesita - c.dan)} ms)\n     «${c.texto}»`).join('\n') +
    '\n\n   El profesional lo ve desaparecer por la mitad y no puede recuperarlo.');
});

test('SCRUM-443 · ✅ el error MÁS LARGO del producto se lee entero, con margen', () => {
  const errores = censoDeToasts().filter((t) => t.kind === 'error');
  const masLargo = errores.slice().sort((a, b) => b.texto.length - a.texto.length)[0];
  const dan = duracion(masLargo.texto, 'error');
  const necesita = msDeLectura(masLargo.texto);
  assert.ok(dan >= necesita * 1.15,
    `🔴 el error más largo (${masLargo.texto.length} car, ${masLargo.fichero}) tiene ${dan} ms y ` +
    `necesita ~${Math.round(necesita)} ms: va justo, sin margen para mirar el móvil con retraso.`);
});

// ── 🔴 EL QUE FIJA EL MOTIVO: UN MENSAJE MÁS LARGO NO PUEDE COLARSE ──────────────────────

test('SCRUM-443 · 🔴 un mensaje MÁS LARGO que el de calibración sigue cabiendo', () => {
  // Calibrado el 10-ago-2026 contra los 136 caracteres del error más largo del producto. Pero el
  // guard NO se queda en ese número: comprueba que la relación aguanta MUY por encima, porque el
  // defecto original fue justamente que el mensaje creció y la duración no.
  const CALIBRADO_CONTRA = 136;
  const censo = censoDeToasts().filter((t) => t.kind === 'error');
  const maxReal = Math.max(...censo.map((t) => t.texto.length));
  assert.ok(maxReal <= CALIBRADO_CONTRA,
    `🔴 ha aparecido un error de ${maxReal} caracteres y la calibración se hizo contra ` +
    `${CALIBRADO_CONTRA}. NO es que esté roto: es que hay que volver a mirar el tope y anotarlo ` +
    'aquí. Este assert existe para que ese crecimiento no pase desapercibido, que es como se ' +
    'rompió la duración fija de 5 s.');

  // Y la relación se sostiene bastante más allá del tope de hoy: o el aviso cabe en su duración,
  // o NO SE CIERRA SOLO. Lo que no puede pasar nunca es que se vaya antes de poder leerse.
  //
  // 🔴 Este bucle cazó el primer intento de la fórmula: con un tope de 15 s, un mensaje de 300
  // caracteres —~16,7 s— se iba recortado. Es decir, había reconstruido el defecto original un
  // escalón más arriba. La salida no fue subir el tope: fue dejar de autocerrar lo que no cabe.
  for (const largo of [150, 200, 300, 800]) {
    const texto = 'x'.repeat(largo);
    const ms = duracion(texto, 'error');
    assert.ok(ms === null || ms >= msDeLectura(texto),
      `🔴 un error de ${largo} caracteres se cierra a los ${ms} ms y necesita ` +
      `~${Math.round(msDeLectura(texto))} ms. Se iría antes de poder leerse: es el defecto original ` +
      'otra vez, sólo que con mensajes más largos.');
  }
});

test('SCRUM-443 · 🔴 lo que NO se cierra solo SIEMPRE se puede cerrar a mano', () => {
  // La trampa que hay que evitar: un aviso que se queda y no se puede quitar es peor que uno que
  // se va pronto. Sólo los errores pueden devolver `null`, y los errores son justo los que llevan
  // botón de cierre.
  for (const kind of ['ok', 'warn']) {
    for (const largo of [10, 300, 800]) {
      assert.notEqual(duracion('x'.repeat(largo), kind), null,
        `🔴 un aviso «${kind}» de ${largo} car no se cerraría solo, y esos NO llevan botón de ` +
        'cierre: se quedaría en pantalla para siempre.');
    }
  }
  const src = fs.readFileSync(path.join(DIR_JS, 'api.js'), 'utf8');
  assert.match(src, /const ms = duracionToast\(msg, kind\);\s*\r?\n\s*if \(ms !== null\) setTimeout/,
    '🔴 el `null` ya no evita el autocierre, o se aplica sin comprobarlo.');
});

// ── EL NEGATIVO QUE MÁS FÁCIL SE ROMPE ───────────────────────────────────────────────────

test('SCRUM-443 · 🔴 los avisos de ÉXITO conservan su duración EXACTA (3.000 ms)', () => {
  // Es lo que más fácil se rompe al tocar esto: un «guardado» quiere irse rápido y estorbar lo
  // mínimo. Se fija el número porque aquí el número ES la decisión, no una derivada.
  for (const texto of ['Guardado', '✓ Enlace copiado — mándaselo por SMS o desde tu WhatsApp', 'x'.repeat(300)]) {
    assert.equal(duracion(texto, 'ok'), 3000,
      `🔴 un aviso de ÉXITO ha cambiado de duración («${texto.slice(0, 30)}…»). Alargar los errores ` +
      'NO puede arrastrar a los de éxito: son otra cosa y molestan si se quedan.');
    assert.equal(duracion(texto, 'warn'), 3000, '🔴 un aviso `warn` ha cambiado de duración.');
  }
});

test('SCRUM-443 · la duración de error nunca BAJA del suelo que ya había', () => {
  // Esto sólo puede alargar. Un mensaje corto de error sigue durando lo de antes.
  assert.equal(duracion('Error', 'error'), 5000,
    '🔴 un error corto dura menos que los 5.000 ms que ya tenía. El cambio era para alargar.');
});

// ── EL CIERRE A MANO Y LA FORMA ──────────────────────────────────────────────────────────

test('SCRUM-443 · ✅ un error se puede CERRAR a mano, y reutiliza el patrón de la casa', () => {
  const src = fs.readFileSync(path.join(DIR_JS, 'api.js'), 'utf8');
  assert.match(src, /cerrar\.className = 'modal-close'/,
    '🔴 el botón de cerrar no reutiliza `.modal-close`, el patrón que ya usan seis componentes. ' +
    'Un segundo botón de cerrar con otra pinta es exactamente lo que no hay que inventar.');
  assert.match(src, /cerrar\.addEventListener\('click', \(\) => toast\.remove\(\)\)/,
    '🔴 el botón de cerrar no cierra nada.');
  assert.match(src, /cerrar\.setAttribute\('aria-label', 'Cerrar'\)/,
    '🔴 el cierre no tiene `aria-label`: para un lector de pantalla sería un botón sin nombre.');
});

test('SCRUM-443 · el cierre SOLO va en los errores', () => {
  const src = fs.readFileSync(path.join(DIR_JS, 'api.js'), 'utf8');
  const bloque = /if \(kind === 'error'\) \{[\s\S]*?modal-close[\s\S]*?\n  \}/.exec(src);
  assert.ok(bloque,
    '🔴 el botón de cerrar ya no está dentro de `if (kind === \'error\')`. Un «guardado» de 3 s con ' +
    'una aspa al lado es ruido: son los errores los que duran lo bastante como para estorbar.');
});

test('SCRUM-443 · la forma deja de asumir UNA LÍNEA cuando el texto no cabe en una', () => {
  const src = fs.readFileSync(path.join(DIR_JS, 'api.js'), 'utf8');
  assert.match(src, /border-radius:\$\{unaLinea \? '999px' : '[^']+'\}/,
    '🔴 el radio vuelve a ser fijo. `999px` está pensado para una línea: con tres, los extremos ' +
    'curvos se comen las esquinas del texto.');
  // Y el umbral se aplica sobre el mensaje, no sobre el tipo.
  assert.match(src, /const unaLinea = String\(msg[^)]*\)\.length <= TOAST_LARGO_UNA_LINEA/,
    '🔴 la forma ya no se decide por la longitud del mensaje.');
});

test('SCRUM-443 · el texto va en su propio nodo y NO se toca ningún mensaje', () => {
  const src = fs.readFileSync(path.join(DIR_JS, 'api.js'), 'utf8');
  assert.match(src, /texto\.textContent = msg;/,
    '🔴 el mensaje ya no se pinta tal cual: esta tarea cambia el CONTENEDOR, jamás el contenido.');
});

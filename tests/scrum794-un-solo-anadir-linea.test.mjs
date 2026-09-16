// tests/scrum794-un-solo-anadir-linea.test.mjs — SCRUM-794
//
// Sin gate: banco de vistas y lectura del fuente. Ni BD, ni red, ni navegador.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// UN SOLO «+ Añadir línea» EN EL EDITOR DE PRESUPUESTOS.
//
// Había DOS, con el mismo rótulo y la misma función (los dos colgaban de `addLineAndFocus`): uno
// suelto en la cabecera de la sección «2. Líneas» y otro a ancho completo debajo de la última
// línea. El fundador firmó quedarse con el de abajo.
//
// ── 🔴 LO QUE HUBO QUE COMPROBAR ANTES DE BORRAR, Y POR QUÉ ─────────────────────────────────
// Que el de arriba no fuera **el único camino en algún estado**. Sería el defecto de SCRUM-792 con
// otra cara: allí las dos vías de «seleccionar todo» se ocultaban a la vez en móvil y el resultado
// era una función inalcanzable. Aquí se comprueba por partida doble:
//   ① el estado de CERO líneas NO EXISTE (se arranca con `LINEAS_CUADERNILLO` y hay suelo de 1);
//   ② ninguno de los dos botones era condicional: se añadían al montar, fuera de todo `if`.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const VISTA = path.join(RAIZ, 'public/dashboard/js/quotesView.js');
const ROTULO = '+ Añadir línea';

async function editor() {
  const b = cargarDashboard(RAIZ, {
    datos: (url) => {
      const u = String(url || '');
      if (/\/admin\/customers/.test(u)) return [{ id: 1, name: 'Fincas Soler', phone: '34000000001' }];
      if (/\/admin\/merchant/.test(u)) return { id: 1, name: 'Fontanería Soler' };
      return [];
    },
  });
  const r = await pintarVista(b, 'renderQuotesView');
  assert.equal(r.error, null, `🔴 el editor no monta: ${r.error && r.error.message}`);
  return r;
}
const clases = (n) => String(n.className || '').split(/\s+/).filter(Boolean);
// 🔴 LAS LÍNEAS NO SON `<tr>`: SCRUM-139 F1 las convirtió en tarjetas `div.quote-line`. Buscarlas
// por TR devuelve CERO en todos los estados — y de ese cero ciego se concluye cualquier cosa.
const filas = (raiz) => todos(raiz).filter((n) => clases(n).includes('quote-line'));
const anadir = (raiz) => todos(raiz).filter((n) => n.tagName === 'BUTTON'
  && String(n.textContent || '').trim() === ROTULO);

// ═══ ① EL QUE DECIDE ═════════════════════════════════════════════════════════════════════

test('SCRUM-794 · 🔴 EL QUE DECIDE: hay EXACTAMENTE UN «+ Añadir línea», y es el de abajo', async () => {
  const r = await editor();
  // SUELO: sin líneas montadas, «hay un botón» no diría nada del editor de verdad.
  assert.ok(filas(r.contenedor).length >= 1,
    `🔴 CIEGO: el editor montó ${filas(r.contenedor).length} líneas. Sin líneas no hay pantalla que medir.`);

  const bs = anadir(r.contenedor);
  assert.equal(bs.length, 1,
    `🔴 hay ${bs.length} botones «${ROTULO}» y tiene que haber UNO. Cero = la única forma de añadir `
    + 'una línea a mano ha desaparecido; dos = ha vuelto el duplicado que este ticket quitó.');
  assert.deepEqual(clases(bs[0]), ['btn-ghost', 'quote-add-line'],
    `🔴 el que queda no es el de ABAJO (\`btn-ghost quote-add-line\`), es \`${bs[0].className}\`. `
    + 'El fundador firmó quedarse con el de abajo, el de ancho completo pegado a la última línea.');
});

test('SCRUM-794 · 🔴 y AÑADE LÍNEA de verdad al pulsarlo', async () => {
  const r = await editor();
  const antes = filas(r.contenedor).length;
  const b = anadir(r.contenedor)[0];
  assert.ok(b, '🔴 CIEGO: no hay botón que pulsar.');
  try {
    b.disparar('click');
  } catch (e) {
    // ⚠️ EL BANCO NO TIENE `scrollIntoView`, y `addLineAndFocus` lo llama DESPUÉS de añadir. Ese
    // fallo concreto se tolera porque la línea YA ENTRÓ; cualquier otro se relanza, para no
    // convertir este `catch` en un sitio donde mueren los defectos de verdad.
    if (!/scrollIntoView is not a function/.test(String(e && e.message))) throw e;
  }
  assert.equal(filas(r.contenedor).length, antes + 1,
    `🔴 pulsar «${ROTULO}» dejó ${filas(r.contenedor).length} líneas y había ${antes}: el botón que `
    + 'queda no añade nada.');
});

// ═══ ② POR QUÉ UNO BASTA: LOS DOS HECHOS QUE HABÍA QUE COMPROBAR ANTES DE BORRAR ═════════

test('SCRUM-794 · 🔴 el estado de CERO LÍNEAS no existe: hay cuadernillo al montar y suelo al borrar', () => {
  // Si algún día se pudiera llegar a cero líneas, habría que volver a mirar este ticket: el botón
  // de abajo vive pegado a la lista, y un editor vacío es justo donde un único camino se puede
  // quedar sin sitio. Mientras estas dos garantías estén, no puede pasar.
  const fuente = fs.readFileSync(VISTA, 'utf8');
  const m = fuente.match(/const LINEAS_CUADERNILLO = (\d+);/);
  assert.ok(m, '🔴 CIEGO: no encuentro `LINEAS_CUADERNILLO`.');
  assert.ok(Number(m[1]) >= 1,
    `🔴 el cuadernillo pinta ${m[1]} líneas: el editor podría arrancar vacío.`);
  assert.match(fuente, /^\s*dibujarCuadernillo\(\);\s*$/m,
    '🔴 ya no se llama a `dibujarCuadernillo()` al montar: el editor arrancaría sin líneas.');
  assert.match(fuente, /if \(lines\.length === 1\) \{[\s\S]{0,900}?return;/,
    '🔴 ha desaparecido el suelo de «siempre al menos una línea» al borrar. Con él se podría '
    + 'vaciar la lista entera, y entonces este ticket hay que volver a medirlo.');
});

test('SCRUM-794 · 🔴 el botón que queda NO es condicional: se añade al montar, fuera de todo `if`', () => {
  // Es la otra mitad de «uno basta». Si el `appendChild` viviera dentro de un `if` o de un bucle,
  // habría estados sin ningún «+ Añadir línea» y el duplicado que se ha borrado podría haber sido
  // la red de esos estados.
  const fuente = fs.readFileSync(VISTA, 'utf8');
  const sf = ts.createSourceFile('quotesView.js', fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let hallado = null;
  const v = (n) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
      && n.expression.name.text === 'appendChild'
      && n.arguments.length === 1 && ts.isIdentifier(n.arguments[0])
      && n.arguments[0].text === 'addLineBtnBottom') {
      const envolturas = [];
      let p = n.parent;
      while (p) {
        if (ts.isIfStatement(p)) envolturas.push('if');
        if (ts.isForStatement(p) || ts.isForOfStatement(p) || ts.isForInStatement(p) || ts.isWhileStatement(p)) envolturas.push('bucle');
        if (ts.isConditionalExpression(p)) envolturas.push('?:');
        p = p.parent;
      }
      hallado = { linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, envolturas };
    }
    ts.forEachChild(n, v);
  };
  v(sf);
  assert.ok(hallado, '🔴 CIEGO: no encuentro el `appendChild` de `addLineBtnBottom`.');
  assert.deepEqual(hallado.envolturas, [],
    `🔴 el botón que queda se añade dentro de ${hallado.envolturas.join(' > ')} (línea ${hallado.linea}): `
    + 'hay estados de la pantalla sin ninguna forma de añadir una línea a mano.');
});

// ═══ ③ EL BORRADO, EN EL FUENTE ══════════════════════════════════════════════════════════

test('SCRUM-794 · ⛔ el de ARRIBA no vuelve, y no se ha escrito ningún literal nuevo', () => {
  const fuente = fs.readFileSync(VISTA, 'utf8');
  const ejecutable = fuente.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

  // Hermano del token (SCRUM-237): el detector tiene que ver la forma que busca antes de creerle.
  assert.match('  const addLineBtn = document.createElement("button");', /const addLineBtn\b/,
    '🔴 el detector no reconoce su propia forma: su «no aparece» no valdría nada.');
  assert.doesNotMatch(ejecutable, /const addLineBtn\b/,
    '🔴 ha vuelto `addLineBtn`: el duplicado que este ticket borró está otra vez ahí.');

  // Y el rótulo se escribe UNA sola vez: dos literales iguales es como vuelve un duplicado.
  const veces = (ejecutable.match(/"\+ Añadir línea"/g) || []).length;
  assert.equal(veces, 1,
    `🔴 el rótulo «${ROTULO}» aparece ${veces} veces en el código ejecutable y tiene que aparecer `
    + 'UNA. Este ticket BORRA un botón: no se escribe ningún texto nuevo (regla 30).');
});

/** 🔴 LAS MUTACIONES QUE TIENEN QUE TUMBARME (contrato de SCRUM-745). */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // ① Vuelve el botón de arriba: el duplicado exacto que el fundador mandó quitar.
    fichero: 'public/dashboard/js/quotesView.js',
    de: '  const aiBtn = document.createElement("button");\n  aiBtn.type = "button";',
    a: '  const addLineBtn = document.createElement("button");\n  addLineBtn.textContent = "+ Añadir línea";\n  linesHeader.appendChild(addLineBtn);\n  const aiBtn = document.createElement("button");\n  aiBtn.type = "button";',
    cae: 'EL QUE DECIDE: hay EXACTAMENTE UN «+ Añadir línea», y es el de abajo',
  },
  {
    // ② Desaparece el suelo de «siempre al menos una línea»: el editor podría quedarse vacío, que
    // es el estado en el que un único botón habría que volver a medir.
    fichero: 'public/dashboard/js/quotesView.js',
    de: '      if (lines.length === 1) {',
    a: '      if (false) {',
    cae: 'el estado de CERO LÍNEAS no existe: hay cuadernillo al montar y suelo al borrar',
  },
];

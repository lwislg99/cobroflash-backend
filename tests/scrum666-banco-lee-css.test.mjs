// tests/scrum666-banco-lee-css.test.mjs — SCRUM-666
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// EL BANCO YA MIRA EL CSS EXTERNO — Y DICE CUÁNDO NO SABE MIRAR
//
// El hueco lo declaró SCRUM-660 al entregar: «el banco no aplica CSS externo; un `display:none`
// en `styles.css` no se detecta». No era el hueco de un campo: era el de TODOS los controles de
// visibilidad que se escriban de aquí en adelante, y producía **verdes falsos**.
//
// ── LO QUE DECIDIÓ EL DISEÑO, y era una apuesta que los números refutaron ─────────────────
// Se esperaba que las reglas que ocultan fueran simples y que el matcher de SCRUM-451 las
// resolviera casi todas. Global: resuelve el 63 %. **Pero las DOS que ocultan campos del editor
// de líneas —justo lo que mide el control de SCRUM-660— usan `:not(:focus-within) >` y no
// resuelve ninguna.**
//
// O sea: un lector que aplicara sólo lo que sabe resolver diría «se ve» precisamente donde no
// sabe mirar. Por eso `ocultoPorCss` tiene TRES respuestas y no dos, y la tercera —CIEGO— es la
// que hace que esto sirva. Es la doctrina que este banco lleva tres tickets desterrando
// (SCRUM-451, 444, 634): lo que no se sabe resolver se ANOTA, no se contesta.
// ═══════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hojasDelDashboard, reglasQueOcultan, ocultoPorCss, nodo } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Un nodo suelto con su cadena de padres, para poder preguntar por él sin montar la pantalla. */
function conPadres(...clases) {
  const reg = { porId: new Map(), errores: [], idsNoResueltos: [], selectoresNoSoportados: [] };
  let ultimo = null;
  for (const c of clases) {
    const n = nodo('div', reg);
    n.className = c;
    if (ultimo) ultimo.appendChild(n);
    ultimo = n;
  }
  return ultimo;
}

// ═══ SUELO ═════════════════════════════════════════════════════════════════════════════════
test('SCRUM-666 · SUELO: el índice declara hojas locales y se encuentran', () => {
  const hojas = hojasDelDashboard(RAIZ);
  assert.ok(hojas.length >= 2,
    `🔴 CIEGO: el índice declara ${hojas.length} hoja(s) local(es). Se midió que son DOS `
    + '(`tokens.css` y `css/styles.css`); si ahora sale menos, o el índice cambió o el lector '
    + 'dejó de verlas — y en los dos casos lo de abajo mediría de menos sin decirlo.');
  assert.ok(hojas.every((h) => !/^https?:/.test(h)),
    '🔴 se ha colado una hoja REMOTA: no se lee ni se debe (la de Google Fonts)');
});

test('SCRUM-666 · 🔴 SUELO: cero reglas LANZA, no devuelve cero', () => {
  // «No hay reglas que oculten» y «no supe abrir el fichero» son el mismo número con
  // significados opuestos. El segundo tiene que doler.
  assert.throws(() => reglasQueOcultan(RAIZ, [path.join(RAIZ, 'no/existe/jamas.css')]),
    /ENOENT|no such file/i,
    '🔴 apuntado a un fichero que NO EXISTE, el lector debería LANZAR. Si devolviera cero reglas, '
    + 'todos los controles de visibilidad pasarían a verde sin mirar nada.');
  assert.throws(() => reglasQueOcultan(RAIZ, [path.join(RAIZ, 'public/tokens.css')]),
    /SUELO/,
    '🔴 con una hoja que NO tiene ninguna regla de ocultación, el lector debe declararlo en vez de '
    + 'devolver una lista vacía que se lee como «aquí no se esconde nada».');
});

test('SCRUM-666 · SUELO: sobre las hojas de verdad encuentra reglas', () => {
  const r = reglasQueOcultan(RAIZ);
  assert.ok(r.length >= 10,
    `🔴 sólo encuentro ${r.length} reglas que ocultan. Se midieron 24 (los 7 \`opacity:0\` viven `
    + 'dentro de `@keyframes` y NO cuentan: son fotogramas). Un número mucho menor significa que '
    + 'el troceador se rompió, no que el CSS adelgazara.');
  assert.ok(r.every((x) => x.dentroDe !== '@keyframes'),
    '🔴 se han colado fotogramas de animación: un `opacity:0` dentro de `@keyframes` describe un '
    + 'instante, no esconde nada, y marcarlo llenaría de falsos positivos.');
  assert.ok(r.some((x) => x.formas.includes('display:none')), '🔴 no encuentra ni un `display:none`');
});

// ═══ ① LA RESPUESTA DE TRES ESTADOS ════════════════════════════════════════════════════════
test('SCRUM-666 · 🔴 una regla que el matcher SABE resolver → `oculto: true`', () => {
  const reglas = [{ hoja: 'x.css', selector: '.escondida', formas: ['display:none'], dentroDe: null }];
  const n = conPadres('padre', 'escondida');
  const r = ocultoPorCss(n, reglas);
  assert.equal(r.oculto, true, '🔴 no ve una regla directa sobre la clase del nodo');
  assert.match(r.porQue, /\.escondida/, '🔴 no dice QUÉ regla lo esconde: un rojo sin culpable no se arregla');

  // Y por un ANCESTRO, que es como se esconde media pantalla de golpe.
  const hijo = conPadres('escondida', 'hijo');
  assert.equal(ocultoPorCss(hijo, reglas).oculto, true, '🔴 no ve la regla aplicada al PADRE');
});

test('SCRUM-666 · ✅ CONTROL NEGATIVO: color y margen NO marcan nada', () => {
  // Un guard que marca todo no marca nada.
  //
  // ⚠️ EL FIXTURE DE ESTE TEST YA ME ENGAÑÓ UNA VEZ: la primera versión usaba
  // `.quote-line__label` como «nodo corriente», y NO lo es — hay una regla real que lo menciona
  // (`.quote-line--vacia:not(:focus-within) > .quote-line__concept > .quote-line__label`) y el
  // lector se declaraba ciego CON RAZÓN. El rojo era del fixture, no del lector. Aquí se usa una
  // clase que no aparece en ninguna hoja.
  const r = reglasQueOcultan(RAIZ);
  const n = conPadres('caja-que-no-existe-en-el-css', 'campo-que-tampoco');
  assert.equal(ocultoPorCss(n, r).oculto, false,
    '🔴 un nodo que NINGUNA hoja menciona sale como escondido o dudoso: el lector está marcando '
    + 'reglas que no le tocan, y un aviso que salta siempre deja de leerse.');

  // Y explícito, con reglas fabricadas: una de color y otra de margen no son ocultación.
  //
  // 🔴 ESTE CASO CAZÓ UN DEFECTO DEL LECTOR, y por eso está escrito: `ocultoPorCss` no miraba
  // `formas`, así que una regla de color con un selector que casara devolvía «oculto». Lo
  // encontró el control negativo, no una lectura del código.
  const inocuas = [
    { hoja: 'x.css', selector: '.escondida', formas: [], dentroDe: null },
    { hoja: 'x.css', selector: '.escondida', formas: [], dentroDe: null },
  ];
  assert.equal(ocultoPorCss(conPadres('escondida'), inocuas).oculto, false,
    '🔴 marca una regla sin ninguna forma de ocultación');
});

test('SCRUM-666 · 🔴 lo que NO sabe resolver se DECLARA CIEGO, no se contesta «se ve»', () => {
  // Es la mitad del ticket. Medido: las reglas que ocultan el editor de líneas usan
  // `:not(:focus-within) >`, que el matcher no resuelve. Contestar «se ve» ahí sería el verde
  // falso que este banco lleva tres tickets desterrando.
  const reglas = [{
    hoja: 'x.css',
    selector: '.quote-line--vacia:not(:focus-within) > .quote-line__qty',
    formas: ['display:none'],
    dentroDe: null,
  }];
  const n = conPadres('quote-line--vacia', 'quote-line__qty');
  const r = ocultoPorCss(n, reglas);
  assert.equal(r.oculto, null,
    `🔴 ha contestado \`${r.oculto}\` ante un selector que NO sabe resolver. Decir «se ve» donde `
    + 'no se sabe mirar es exactamente el `null` mudo de SCRUM-451, con otro disfraz.');
  assert.equal(r.ciego.length, 1, '🔴 no ha anotado la regla que no supo resolver');
  assert.match(r.ciego[0], /focus-within/, '🔴 la anotación no dice cuál es');
});

test('SCRUM-666 · ✅ pero NO se declara ciego por reglas que no tienen nada que ver', () => {
  // La otra mitad: si cualquier selector no resoluble dejara todo «no lo sé», el aviso sería
  // ruido y nadie lo miraría — que es como muere un guard.
  const reglas = [{
    hoja: 'x.css', selector: '.otra-cosa:not(.abierta) > .nada-que-ver',
    formas: ['display:none'], dentroDe: null,
  }];
  const r = ocultoPorCss(conPadres('quote-line', 'quote-line__qty'), reglas);
  assert.equal(r.oculto, false,
    '🔴 se declara ciego por una regla que no menciona ninguna clase de este nodo: eso convierte '
    + 'la ceguera en ruido y el aviso deja de servir.');
  assert.equal(r.ciego.length, 0);
});

// ═══ ② LO QUE MIDE DE VERDAD, sobre las hojas del repositorio ══════════════════════════════
test('SCRUM-666 · el reparto medido sobre las hojas reales queda FIJADO', () => {
  const r = reglasQueOcultan(RAIZ);
  const SIMPLE = /^([a-zA-Z][\w-]*)?((?:[#.][\w-]+|\[[^\]]+\])*)$/;
  const resuelve = (sel) => sel.trim().split(/\s+/).every((p) => SIMPLE.test(p));
  let total = 0; let ok = 0;
  for (const x of r) {
    for (const parte of x.selector.split(',').map((s) => s.trim()).filter(Boolean)) {
      total++; if (resuelve(parte)) ok++;
    }
  }
  assert.ok(total >= 20, `🔴 sólo ${total} partes de selector: el troceador ha dejado de ver`);
  assert.ok(ok / total > 0.4 && ok / total < 0.9,
    `El matcher resuelve ${ok}/${total} (${(100 * ok / total).toFixed(0)} %). Se midió ~57 %. Si `
    + 'sube mucho, alguien ha simplificado el CSS o ampliado el matcher —bien, anótalo—; si baja, '
    + 'el banco se está quedando ciego en más sitios de los que declara.');
});

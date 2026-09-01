// tests/scrum630-default-en-dias.test.mjs — SCRUM-630
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL VALOR POR DEFECTO DE «VÁLIDO HASTA» NO SUMABA 30 DÍAS DE CALENDARIO
//
//     new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
//
// El defecto salió midiendo otra cosa: al romper SCRUM-605 a propósito con aritmética en
// milisegundos, «31 de marzo + 30 días» dio **29 de abril** en vez del 30.
//
// 🔴 Y AL MEDIRLO AQUÍ RESULTÓ QUE MI EXPLICACIÓN DE ENTONCES ERA IMPRECISA. Conté que era «el
// cambio de hora de marzo». Lo que muerde NO es `86400000`: es **`toISOString()`, que formatea
// en UTC**. Con un desfase local positivo, una hora temprana cae en el día ANTERIOR en UTC, y
// por eso el 31 de marzo a medianoche daba el 29 de abril. La aritmética en milisegundos, por sí
// sola, no cambia el día a horas normales: un salto de una hora sobre el mediodía sigue cayendo
// en el mismo día. Decirlo bien importa: quien lea «cambio de hora» buscaría el defecto dos días
// al año.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 Y ESTA SEGUNDA VERSIÓN NACE DE UN ROJO EN CI, QUE TENÍA RAZÓN
//
// La primera versión de este fichero midió «210 de 365 a las 00:30» y congeló ese 210. En CI
// salió **0**, y el mensaje de error ya decía qué significaba eso: «o el defecto se arregló por
// otro sitio, o estoy comparando la misma función consigo misma». No era ninguna de las dos.
//
// **El test medía la ZONA HORARIA DE LA MÁQUINA, no el defecto.** El mismo barrido, con la zona
// fijada a mano (medido, no razonado):
//
//     UTC              (+0 / +0)  →    0 de 365      ← lo que da el runner de CI
//     Europe/London    (+0 / +1)  →  210 de 365      ← de aquí salió el 210
//     Europe/Madrid    (+1 / +2)  →  365 de 365      ← el producto es España-first
//     Atlantic/Canary  (+0 / +1)  →  210 de 365
//     America/New_York (−5 / −4)  →    0 de 365
//
// O sea: **el 210 nunca fue un número de Madrid, era de Londres** — la zona efectiva de la
// máquina donde se midió. Un número londinense congelado dentro de un producto español.
//
// Con la zona fijada en Madrid el defecto da 365/365, así que **sigue intacto**: el 0 de CI era
// la máquina y no un arreglo por otro sitio. Por eso aquí la zona ya no se hereda del proceso:
// se pasa a mano, y se afirman LAS DOS direcciones —Madrid 365 y UTC 0—, porque un test que no
// distingue las dos zonas vuelve a medir la máquina.
//
// ⚠️ Y DE PASO SE CORRIGE ALGO QUE ESCRIBÍ MAL EN SCRUM-633: allí dejé dicho que «`TZ=` no surte
// efecto en este Node/Windows». Es impreciso. Lo que no surte efecto es el PREFIJO de Git Bash
// (`TZ=x node …`); pasada como entorno de un proceso HIJO, `TZ` funciona perfectamente. Eso
// permite la prueba que antes no se pudo hacer — correr el fichero entero con la zona forzada:
//
//     ZONA DEL PROCESO    TEST VIEJO            TEST NUEVO
//     Europe/Madrid       pass 11 · fail 1  🔴  pass 16 · fail 0
//     Europe/London       pass 12 · fail 0      pass 16 · fail 0
//     UTC                 pass 10 · fail 2  🔴  pass 16 · fail 0
//     America/New_York    pass  9 · fail 3  🔴  pass 16 · fail 0
//     Asia/Tokyo          pass 11 · fail 1  🔴  pass 16 · fail 0
//
// **El test viejo sólo pasaba en UNA zona del planeta: la de la máquina donde se escribió** — y
// ni siquiera en la del producto. El nuevo pasa en las cinco. Y el rojo de CI era la punta: en
// UTC caían DOS pruebas, y con desfase negativo TRES, porque el «control negativo» también
// dependía de la máquina (ver el test de Nueva York, más abajo).
//
// 🔴 EL ARREGLO ES REUTILIZAR, NO REESCRIBIR. La primitiva ya existía (`fechaDeAtajo`, de
// SCRUM-605) con sus bordes probados. Escribir una segunda habría sido el defecto de familia de
// SCRUM-617/620/625/627/629: existe una primitiva y alguien no la usa.
// ─────────────────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const RAIZ = path.resolve(import.meta.dirname, '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

const front = {};
new Function('window', leer('public/dashboard/js/quoteAtajosVencimiento.js'))(front);
const A = front.QUOTE_ATAJOS_VENCIMIENTO;

// ─────────────────────────────────────────────────────────────────────────────────────────
// EL RELOJ, EXPLÍCITO · sin esto el barrido mide la máquina donde corre
//
// La zona NO se hereda del proceso: se pasa a mano con `Intl`. Y se pasa a mano aunque `TZ`
// funcione en un hijo, porque este código —`quotesView.js`— corre en el NAVEGADOR DEL
// PROFESIONAL, no en el servidor: la zona que hay que fijar es la suya (España-first, Madrid),
// no la de la máquina que ejecuta la tanda. La regla que sale de aquí: **cada test fija la zona
// de la máquina donde ese código corre de verdad** — front → Madrid, servidor → UTC.
// Sin librerías: sólo `Intl` y `Date.UTC`.
// ─────────────────────────────────────────────────────────────────────────────────────────
const FMT = new Map();
function formateador(tz) {
  if (!FMT.has(tz)) {
    FMT.set(tz, new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }));
  }
  return FMT.get(tz);
}
/** El reloj de PARED de la zona `tz` en ese instante. */
function paredEn(ts, tz) {
  const p = Object.fromEntries(formateador(tz).formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, hh: +p.hour % 24, mm: +p.minute, ss: +p.second };
}
function desfaseEn(ts, tz) {
  const p = paredEn(ts, tz);
  return Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss) - ts;
}
/** El INSTANTE en que la zona `tz` marca ese reloj de pared. */
function instanteDe(y, m, d, hh, mm, tz) {
  const objetivo = Date.UTC(y, m - 1, d, hh, mm, 0);
  let ts = objetivo;
  for (let i = 0; i < 3; i++) ts = objetivo - desfaseEn(ts, tz);
  return ts;
}

/** La aritmética VIEJA, tal cual estaba: milisegundos y `toISOString()`, que formatea en UTC. */
function comoAntes(ts, dias) {
  return new Date(ts + dias * 86400000).toISOString().slice(0, 10);
}
/** La NUEVA: componentes de fecha LOCALES de la zona `tz`, que es lo que ve el profesional. */
function comoAhora(ts, tz, dias) {
  const p = paredEn(ts, tz);
  return A.fechaDeAtajo(dias, new Date(p.y, p.m - 1, p.d));
}

/** Recorre 2026 a esa hora de pared en esa zona y cuenta en cuántos días difieren las dos. */
function barrer(tz, hh, mm, dias = 30) {
  let dif = 0; let total = 0; const muestra = [];
  for (let i = 0; i < 365; i++) {
    const b = new Date(Date.UTC(2026, 0, 1) + i * 86400000);
    const ts = instanteDe(b.getUTCFullYear(), b.getUTCMonth() + 1, b.getUTCDate(), hh, mm, tz);
    total++;
    const antes = comoAntes(ts, dias);
    const ahora = comoAhora(ts, tz, dias);
    if (antes !== ahora) { dif++; if (muestra.length < 3) muestra.push(`${antes} -> ${ahora}`); }
  }
  return { dif, total, muestra };
}

// Las zonas que importan, con por qué importa cada una.
const MADRID = 'Europe/Madrid';   // el producto es España-first: ÉSTA es la que manda
const LONDRES = 'Europe/London';  // de aquí salió el 210 que se congeló por error
const NUEVA_YORK = 'America/New_York'; // desfase NEGATIVO: rompe el control negativo, ver abajo

/**
 * Las sumas o restas de un múltiplo EXACTO de un día en milisegundos que hay en una fuente.
 *
 * 🔴 POR AST, NO POR TEXTO, y no es preferencia: la primera versión de este guard buscaba la
 * cadena «Date.now() + 30 * 86400000» y CAYÓ SOLA — mi propio comentario, el que explica por qué
 * esa suma está prohibida, la contiene. Es el guard de texto que se caza a sí mismo en la nota
 * que explica la prohibición. Con AST los comentarios quedan fuera POR CONSTRUCCIÓN.
 *
 * Y evalúa el NÚMERO en vez de buscarlo escrito: `86400000`, `86_400_000`, `24 * 60 * 60 * 1000`
 * y `24 * 3600 * 1000` son el mismo día, y un `grep` no lo sabe.
 */
export function sumasDeDiasEnMs(fuente, ruta = 'x.js') {
  const sf = ts.createSourceFile(ruta, fuente, ts.ScriptTarget.Latest, true);
  const valor = (n) => {
    if (ts.isNumericLiteral(n)) return Number(n.text.replace(/_/g, ''));
    if (ts.isParenthesizedExpression(n)) return valor(n.expression);
    if (ts.isBinaryExpression(n)) {
      const a = valor(n.left); const b = valor(n.right);
      if (a === null || b === null) return null;
      if (n.operatorToken.kind === ts.SyntaxKind.AsteriskToken) return a * b;
      return null;
    }
    return null;
  };
  const fuera = [];
  (function rec(n) {
    if (ts.isBinaryExpression(n)
        && (n.operatorToken.kind === ts.SyntaxKind.PlusToken || n.operatorToken.kind === ts.SyntaxKind.MinusToken)) {
      for (const lado of [n.left, n.right]) {
        const v = valor(lado);
        if (v !== null && v !== 0 && Math.abs(v) % 86400000 === 0) {
          fuera.push(n.getText(sf).replace(/\s+/g, ' ').slice(0, 70));
        }
      }
    }
    n.forEachChild(rec);
  })(sf);
  return fuera;
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// SUELO
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-630 · SUELO: tengo la primitiva y sé reproducir el cálculo viejo', () => {
  assert.equal(typeof A?.fechaDeAtajo, 'function', '🔴 CIEGO: no tengo `fechaDeAtajo`');
  const ts = instanteDe(2026, 6, 10, 12, 0, MADRID);
  assert.equal(comoAntes(ts, 30), comoAhora(ts, MADRID, 30),
    '🔴 mi reproducción del cálculo viejo no coincide con el nuevo ni en un día normal: entonces '
    + 'no estoy comparando lo que creo y nada de lo de abajo vale.');
});

test('SCRUM-630 · 🔴 SUELO: el reloj explícito FUNCIONA, y no lo pone el proceso', () => {
  // Sin esto, unos `paredEn`/`instanteDe` rotos devolverían siempre lo mismo y los barridos de
  // abajo volverían a medir la máquina sin que nadie se enterase.
  assert.equal(desfaseEn(Date.UTC(2026, 0, 15), MADRID), 3600000, '🔴 Madrid en enero no da UTC+1');
  assert.equal(desfaseEn(Date.UTC(2026, 6, 15), MADRID), 7200000, '🔴 Madrid en julio no da UTC+2');
  assert.equal(desfaseEn(Date.UTC(2026, 0, 15), 'UTC'), 0, '🔴 UTC no da desfase cero');
  // Ida y vuelta: el instante de una pared, leído en esa misma zona, devuelve la pared.
  const ts = instanteDe(2026, 3, 31, 0, 30, MADRID);
  const p = paredEn(ts, MADRID);
  assert.deepEqual([p.y, p.m, p.d, p.hh, p.mm], [2026, 3, 31, 0, 30],
    '🔴 el reloj no cierra el círculo: `instanteDe` y `paredEn` no son inversos');
  // Y el proceso NO manda: la misma pared en dos zonas son dos instantes distintos.
  assert.notEqual(instanteDe(2026, 3, 31, 0, 30, MADRID), instanteDe(2026, 3, 31, 0, 30, 'UTC'),
    '🔴 la zona no cambia nada: entonces se está heredando la del proceso y volvemos al rojo de CI');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL ANTES Y EL DESPUÉS, en el caso que destapó el defecto
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-630 · 🔴 31 de marzo a medianoche EN MADRID + 30: antes 29-abr, ahora 30-abr', () => {
  // La zona va escrita. Con la del proceso, este mismo test daba 30-abr en un runner en UTC y
  // caía diciendo que «el arreglo no arregla» — cuando lo que pasaba es que en UTC no hay defecto.
  const ts = instanteDe(2026, 3, 31, 0, 0, MADRID);
  assert.equal(comoAntes(ts, 30), '2026-04-29',
    '🔴 el cálculo viejo ya no da 29-abr EN MADRID: este test dejó de medir el defecto que dice medir');
  assert.equal(comoAhora(ts, MADRID, 30), '2026-04-30',
    '🔴 el cálculo nuevo NO da 30-abr: el arreglo no arregla');
  // Y el mismo instante de pared en UTC: allí las dos aritméticas coinciden. Es el contraste que
  // enseña que el defecto es del DESFASE, no del `86400000`.
  const tsUtc = instanteDe(2026, 3, 31, 0, 0, 'UTC');
  assert.equal(comoAntes(tsUtc, 30), comoAhora(tsUtc, 'UTC', 30),
    '🔴 en UTC las dos aritméticas deberían coincidir: si no, el defecto no es el que creo');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// ✅ EL CONTROL NEGATIVO, QUE ES EL QUE DECIDE
// ─────────────────────────────────────────────────────────────────────────────────────────
const HORAS_NORMALES = [[9, 0], [12, 0], [23, 30]];

test('SCRUM-630 · ✅ a hora normal EN MADRID, el arreglo NO mueve NI UNA fecha en todo el año', () => {
  for (const [hh, mm] of HORAS_NORMALES) {
    const r = barrer(MADRID, hh, mm);
    assert.equal(r.total, 365, '🔴 el barrido no ha recorrido el año entero');
    assert.equal(r.dif, 0,
      `🔴 A LAS ${hh}:${String(mm).padStart(2, '0')} EN MADRID EL ARREGLO MUEVE ${r.dif} FECHAS: `
      + `${r.muestra.join(' · ')}.\n`
      + '  Eso no es arreglar un defecto: es cambiar el comportamiento del producto. Quien no toque '
      + 'nada tiene que seguir viendo exactamente la misma fecha que veía.');
  }
});

test('SCRUM-630 · ⚠️ el control negativo TAMBIÉN dependía de la máquina: con desfase NEGATIVO cae', () => {
  // No es una curiosidad: es la prueba de que fijar la zona hacía falta también AQUÍ. En una
  // máquina al oeste de Greenwich, las 23:30 locales caen en el día SIGUIENTE en UTC y el
  // «arreglo no mueve nada» se convierte en «lo mueve todo». El control negativo de arriba sólo
  // significa algo porque dice EN QUÉ ZONA.
  const r = barrer(NUEVA_YORK, 23, 30);
  assert.equal(r.dif, 365,
    `🔴 en Nueva York a las 23:30 difieren ${r.dif} de ${r.total} y estaban medidos 365. Si esto `
    + 'cambia, la razón por la que el control negativo fija la zona ha dejado de ser cierta y hay '
    + 'que volver a medirla, no borrar el test.');
});

test('SCRUM-630 · 🔴 de MADRUGADA EN MADRID sí difieren — 365 de 365, que es el defecto', () => {
  const r = barrer(MADRID, 0, 30);
  assert.equal(r.total, 365, '🔴 el barrido no ha recorrido el año entero');
  assert.equal(r.dif, 365,
    `🔴 a las 00:30 EN MADRID difieren ${r.dif} días de ${r.total}, y están medidos 365. Si BAJA a `
    + '0, o el defecto se arregló por otro sitio o estoy comparando la misma función consigo misma '
    + '— y entonces el control negativo de arriba no significaría nada.');
});

test('SCRUM-630 · 🔴 LAS DOS DIRECCIONES: en UTC son 0, y eso es el resultado ESPERADO', () => {
  // ÉSTE es el test que faltaba, y por el que CI se puso rojo con razón. En UTC `toISOString()`
  // no desplaza nada, así que no hay defecto que medir: 0 no es un fallo, es la respuesta.
  // Afirmarlo es lo que impide que el barrido de arriba vuelva a medir la máquina en silencio.
  const utc = barrer('UTC', 0, 30);
  assert.equal(utc.dif, 0,
    `🔴 en UTC a las 00:30 difieren ${utc.dif} y deberían ser 0: con desfase cero las dos `
    + 'aritméticas dan lo mismo. Si difieren, el defecto no es el que este fichero dice que es.');

  // Y el 210 histórico, con su procedencia escrita: era de LONDRES, no de Madrid. Se afirma para
  // que el número que se congeló por error quede explicado y no vuelva a colarse como «el dato».
  assert.equal(barrer(LONDRES, 0, 30).dif, 210,
    '🔴 Londres a las 00:30 ya no da 210: era el número que la primera versión de este fichero '
    + 'congeló creyendo que era de Madrid.');

  // 🔴 LA AFIRMACIÓN QUE HACE QUE TODO LO ANTERIOR SIGNIFIQUE ALGO: las zonas se distinguen. Si
  // Madrid y UTC dieran lo mismo, el test estaría heredando la zona del proceso otra vez.
  assert.notEqual(barrer(MADRID, 0, 30).dif, utc.dif,
    '🔴 Madrid y UTC dan el MISMO número: la zona no se está fijando y esto vuelve a medir la '
    + 'máquina donde corre, que es exactamente el rojo que trajo aquí.');
});

test('SCRUM-630 · CONTROL: el barrido no compara una función consigo misma', () => {
  // El mensaje del rojo de CI nombraba esta posibilidad. Se descarta midiéndola: comparando la
  // aritmética NUEVA contra sí misma, cualquier zona da 0. Que Madrid dé 365 arriba sólo puede
  // venir, entonces, de que las dos aritméticas son distintas de verdad.
  for (const tz of [MADRID, 'UTC', LONDRES, NUEVA_YORK]) {
    let dif = 0;
    for (let i = 0; i < 365; i++) {
      const b = new Date(Date.UTC(2026, 0, 1) + i * 86400000);
      const ts = instanteDe(b.getUTCFullYear(), b.getUTCMonth() + 1, b.getUTCDate(), 0, 30, tz);
      if (comoAhora(ts, tz, 30) !== comoAhora(ts, tz, 30)) dif++;
    }
    assert.equal(dif, 0, `🔴 la aritmética nueva no es determinista en ${tz}`);
  }
  // Y el contraste concreto, con las dos cadenas escritas: mismo instante, dos resultados.
  const ts = instanteDe(2026, 3, 31, 0, 30, MADRID);
  assert.equal(comoAntes(ts, 30), '2026-04-29', '🔴 la vieja ya no da 29-abr en Madrid');
  assert.equal(comoAhora(ts, MADRID, 30), '2026-04-30', '🔴 la nueva ya no da 30-abr en Madrid');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// LOS BORDES DE SCRUM-605, que el valor por defecto también tiene que respetar
// ─────────────────────────────────────────────────────────────────────────────────────────
for (const b of [
  { que: '31 de enero + 30 (febrero de 28)', hoy: [2026, 0, 31], dias: 30, esperada: '2026-03-02' },
  { que: '31 de enero + 30 en BISIESTO', hoy: [2024, 0, 31], dias: 30, esperada: '2024-03-01' },
  { que: 'cambio de AÑO', hoy: [2026, 11, 15], dias: 30, esperada: '2027-01-14' },
  { que: '31 de diciembre + 7', hoy: [2026, 11, 31], dias: 7, esperada: '2027-01-07' },
]) {
  test(`SCRUM-630 · el valor por defecto respeta el borde: ${b.que}`, () => {
    const hoy = new Date(b.hoy[0], b.hoy[1], b.hoy[2]);
    assert.equal(A.fechaDeAtajo(b.dias, hoy), b.esperada,
      `🔴 sale ${A.fechaDeAtajo(b.dias, hoy)} y debería ${b.esperada}`);
  });
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// LA VISTA · usa la primitiva, y el orden de carga que lo hace posible está VIGILADO
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-630 · 🔴 el valor por defecto sale de la primitiva, no de una segunda aritmética', () => {
  const vista = leer('public/dashboard/js/quotesView.js');
  assert.equal(vista.split('atajosVencDefecto.fechaDeAtajo(30)').length - 1, 1,
    '🔴 el valor por defecto ya no sale de `fechaDeAtajo`: si alguien ha escrito una segunda '
    + 'aritmética, el defecto de familia ha vuelto (617/620/625/627/629).');

  const sumas = sumasDeDiasEnMs(vista, 'quotesView.js');
  assert.equal(sumas.length, 1,
    `🔴 en \`quotesView.js\` hay ${sumas.length} sumas de días en milisegundos y debe quedar UNA: `
    + `la del \`min\`, que este ticket no toca. Si sube, ha vuelto la aritmética vieja: ${JSON.stringify(sumas)}`);
});

test('SCRUM-630 · CONTROL del detector: sabe VER una suma de días y sabe NO verla', () => {
  // Sin esto, un detector que devolviera siempre `[]` pasaría el test de arriba.
  assert.equal(sumasDeDiasEnMs('const x = Date.now() + 30 * 86400000;').length, 1, '🔴 no ve la forma literal');
  assert.equal(sumasDeDiasEnMs('const x = Date.now() + 7 * 24 * 60 * 60 * 1000;').length, 1, '🔴 no ve la forma factorizada');
  assert.equal(sumasDeDiasEnMs('const x = Date.now() - 14 * 86_400_000;').length, 1, '🔴 no ve la forma con guiones bajos');
  assert.equal(sumasDeDiasEnMs('// Date.now() + 30 * 86400000 en un comentario\nconst x = 1;').length, 0,
    '🔴 cuenta un comentario: es el guard de texto que se caza a sí mismo, otra vez');
  assert.equal(sumasDeDiasEnMs('const x = Date.now() + 3600000;').length, 0, '🔴 cuenta una hora como si fuera un día');
});

test('SCRUM-630 · 🔴 la primitiva se CARGA ANTES que la vista que la usa', () => {
  const html = leer('public/dashboard/index.html');
  const iPrim = html.indexOf('js/quoteAtajosVencimiento.js');
  const iVista = html.indexOf('js/quotesView.js');
  assert.ok(iPrim !== -1, '🔴 la primitiva ya no se carga en el index');
  assert.ok(iVista !== -1, '🔴 la vista ya no se carga en el index');
  assert.ok(iPrim < iVista,
    '🔴 `quoteAtajosVencimiento.js` ha pasado a cargarse DESPUÉS de `quotesView.js`. La vista '
    + 'depende de ella para el valor por defecto: en ese orden el campo saldría VACÍO. La '
    + 'dependencia era implícita y por eso se fija aquí.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// ⚠️ EL `min` NO SE HA TOCADO, y tiene el MISMO defecto.
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-630 · CARACTERIZACIÓN: el `min` sigue con la aritmética vieja (no se tocó)', () => {
  const vista = leer('public/dashboard/js/quotesView.js');
  assert.equal(vista.split('validInput.min = new Date(Date.now() + 86400000).toISOString().slice(0, 10);').length - 1, 1,
    'CARACTERIZACIÓN: el `min` del campo sigue sumando 24 h en milisegundos y formateando en UTC '
    + '— el MISMO defecto que este ticket arregla en el valor por defecto. NO se tocó porque el '
    + 'encargo lo prohíbe expresamente. Si esto falla es que alguien lo cambió: bien, pero que '
    + 'conste con su decisión.');
});

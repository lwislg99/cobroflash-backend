// tests/scrum748-no-lo-se-no-es-al-dia.test.mjs — SCRUM-748
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// UN «NO LO SÉ» PINTADO COMO ÉXITO.
//
// La bandeja de pendientes decidía así:
//
//     const meta = SEMAFORO_META[grupo.semaforo] || SEMAFORO_META.verde;
//
// Cualquier estado que el servidor no supiera nombrar salía en pantalla como **«AL DÍA»**.
// Medido ejecutando esa misma línea con el mapa real del fichero: `sin_datos`, un estado nuevo,
// la cadena vacía, `undefined` y `null` pintaban los cinco lo mismo que el bueno.
//
// 🔴 HOY NO DISPARA, Y AUN ASÍ SE CIERRA. El semáforo tiene tres estados y los tres están en el
// mapa. Es un guard que se abre solo (SCRUM-537) **con el disparador ya escrito en el plan**: el
// día que exista un cuarto estado —cuyo único propósito sería no afirmar lo que no se sabe— el
// navegador lo convertiría en la mentira que ese estado venía a evitar. Cerrarlo hoy es barato;
// el día que muerda, no.
//
// ── EL CRITERIO NO SE INVENTA ───────────────────────────────────────────────────────────────
// Es el de `invoiceStatusMeta` (`api.js:1118`), que ante un estado sin mapear NO elige uno:
// construye una insignia neutra con el código a la vista. Y es el REVERSO exacto de SCRUM-641 —
// en un aviso de error, enseñar el código ES el defecto; en un rótulo de estado, esconderlo lo es.
//
// ⛔ NO se inventa el rótulo (regla 30) ni se construye el cuarto estado (regla 27). Esto sólo
// deja de mentir sobre él.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url'; // SCRUM-730
import ts from 'typescript';
import { cargarDashboard } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VISTA = path.join(RAIZ, 'public/dashboard/js/invoicesView.js');
const DIR_JS = path.join(RAIZ, 'public/dashboard/js');

const banco = cargarDashboard(RAIZ, {});
const metaDelSemaforo = banco.ctx.metaDelSemaforo;
const MARCADOR = banco.ctx.INV_MARCADOR_MICROCOPY;

/** Los tres estados que el semáforo SÍ conoce, con su rótulo aprobado. Congelados. */
const CONOCIDOS = Object.freeze({
  verde: 'AL DÍA',
  ambar: 'PLAZO PRÓXIMO',
  rojo: 'PLAZO VENCIDO',
});

/** Lo que un servidor podría mandar y el mapa no conoce. El primero es el del ticket. */
const DESCONOCIDOS = ['sin_datos', 'CUARTO_ESTADO', 'no_calculado', '', undefined, null];

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① SUELO
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-748 · SUELO: el dashboard carga y publica el decisor', () => {
  assert.equal(banco.fallos.length, 0, 'algún script del dashboard no cargó: nada de abajo vale.');
  assert.equal(typeof metaDelSemaforo, 'function');
  assert.equal(MARCADOR, '[PENDIENTE microcopy oficial]');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② EL DEFECTO · lo desconocido ya no se disfraza del más inocente
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-748 · 🔴 NINGÚN estado desconocido se pinta «AL DÍA»', () => {
  const mienten = [];
  for (const s of DESCONOCIDOS) {
    const { label } = metaDelSemaforo(s);
    if (label === CONOCIDOS.verde) mienten.push(String(s));
  }
  assert.deepEqual(mienten, [],
    '🔴 UN ESTADO DESCONOCIDO SE PINTA COMO «AL DÍA»:\n    ' + mienten.join('\n    ')
    + '\n\n  El profesional lee que ese cliente está al corriente cuando lo que pasa es que no\n'
    + '  sabemos qué le pasa. El día que exista un cuarto estado —cuyo único propósito sería NO\n'
    + '  afirmar lo que no se sabe— esto lo convertiría en la mentira que venía a evitar.');
});

test('SCRUM-748 · 🔴 lo desconocido SE VE: marcador y el código a la vista', () => {
  for (const s of DESCONOCIDOS) {
    const { label } = metaDelSemaforo(s);
    assert.ok(label.startsWith(MARCADOR),
      `🔴 «${s}» se pinta sin marcador («${label}»): sería microcopy que nadie aprobó.`);
  }
  // Y el código del estado viaja en el rótulo, que es lo que distingue este caso de los otros.
  assert.match(metaDelSemaforo('CUARTO_ESTADO').label, /CUARTO_ESTADO/,
    '🔴 el rótulo no dice QUÉ estado no se ha sabido leer: quien pueda mapearlo no sabrá cuál es.');
  // Un código ausente o vacío no puede dejar el rótulo colgando de un espacio.
  for (const s of ['', undefined, null]) {
    assert.equal(/\s$/.test(metaDelSemaforo(s).label), false,
      `🔴 el rótulo de «${s}» termina en espacio: se leería como un fallo de pintado.`);
  }
});

test('SCRUM-748 · 🔴 CONTROL NEGATIVO: los TRES conocidos siguen EXACTAMENTE igual', () => {
  // Si el arreglo moviera un rótulo aprobado, sería una regresión peor que el defecto: son
  // textos firmados que el profesional ya reconoce.
  for (const [estado, label] of Object.entries(CONOCIDOS)) {
    assert.equal(metaDelSemaforo(estado).label, label,
      `🔴 REGRESIÓN: el rótulo de «${estado}» ha cambiado.`);
    assert.equal(metaDelSemaforo(estado).label.includes(MARCADOR), false,
      `🔴 «${estado}» ha ganado un marcador: está aprobado desde antes de este ticket.`);
  }
  // Y su clase de insignia tampoco: el color es parte del mensaje.
  assert.equal(metaDelSemaforo('verde').pillClass, 'status-pill-accepted');
  assert.equal(metaDelSemaforo('rojo').pillClass, 'status-pill-rejected');
});

test('SCRUM-748 · 🔴 y la LÍNEA que decide ya no lleva el respaldo', () => {
  // El decisor podría estar bien y la vista seguir usando el `||` viejo al lado. Se mira lo que
  // hace la vista, por AST: la llamada tiene que estar, y el respaldo a un estado concreto no.
  const src = fs.readFileSync(VISTA, 'utf8');
  const sf = ts.createSourceFile('v.js', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

  let usaElDecisor = 0;
  let respaldoAEstado = 0;
  const v = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)
        && n.expression.text === 'metaDelSemaforo') usaElDecisor += 1;
    // `SEMAFORO_META[…] || SEMAFORO_META.<lo-que-sea>` — el defecto, por su forma
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.BarBarToken
        && ts.isElementAccessExpression(n.left)
        && n.left.expression.getText(sf) === 'SEMAFORO_META'
        && ts.isPropertyAccessExpression(n.right)
        && n.right.expression.getText(sf) === 'SEMAFORO_META') respaldoAEstado += 1;
    ts.forEachChild(n, v);
  };
  v(sf);

  assert.ok(usaElDecisor >= 1,
    '🔴 la vista ya no llama a `metaDelSemaforo`: el arreglo está pero no se usa.');
  assert.equal(respaldoAEstado, 0,
    '🔴 HA VUELTO EL RESPALDO A UN ESTADO CONCRETO en `invoicesView.js`. Un desconocido volvería '
    + 'a pintarse como el estado que se eligiera de respaldo.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ③ EL CENSO · cuántos más hacen lo mismo en el front
// ═════════════════════════════════════════════════════════════════════════════════════════

/**
 * `MAPA[dinámico] || MAPA.<propiedad>` — «lo que no conozca, es ESTE estado concreto».
 *
 * 🔴 POR LO QUE HACE, y la distinción es todo el censo. `MAPA[k] || k` **no entra**: devolver la
 * clave deja ver el código crudo, que es feo pero HONESTO — es el criterio de `invoiceStatusMeta`.
 * `|| 0`, `|| []`, `|| ''` tampoco: son neutros. Lo que se cuenta es elegir OTRO VALOR DEL MISMO
 * MAPA, porque eso convierte «no lo sé» en una afirmación sobre el dominio.
 */
function respaldosQueAfirman(codigo, nombre = 'x.js') {
  const sf = ts.createSourceFile(nombre, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const out = [];
  const v = (n) => {
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.BarBarToken
        && ts.isElementAccessExpression(n.left) && n.left.argumentExpression
        && !ts.isStringLiteralLike(n.left.argumentExpression)
        && ts.isPropertyAccessExpression(n.right)
        && n.right.expression.getText(sf) === n.left.expression.getText(sf)) {
      out.push({
        linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
        mapa: n.left.expression.getText(sf),
        respaldo: n.right.name.text,
      });
    }
    ts.forEachChild(n, v);
  };
  v(sf);
  return out;
}

/**
 * CENSO MEDIDO el 4-sep-2026 sobre `origin/main` = 291b86739079a8b069992deb45fb876f944b8050.
 *
 * 🔴 **NO ERAN TRES: SON SEIS** (cinco tras arreglar el de este ticket). SCRUM-622 encontró uno,
 * S4 encontró éste, y el censo por AST destapa cuatro más. Población: 83 ficheros `.js` de
 * `public/`; la cota bruta —cualquier `MAPA[k] || <algo>`— era **47**, y lo que la baja a seis es
 * exigir que el respaldo sea **otro valor del mismo mapa**.
 *
 * Y con `MAPA[k] || k` —el patrón HONESTO, que deja ver el código— hay **14** sitios: la casa ya
 * sabe hacerlo bien, sólo que no en todas partes.
 *
 * ⚠️ NO SE ARREGLAN AQUÍ: cada uno es de su carril (regla 9). Quedan censados con su número para
 * que el trinquete no deje entrar uno nuevo en silencio.
 *
 * El más grave de los que quedan es `api.js:1285` — `map[…] || map.sent`: un estado de entrega de
 * WhatsApp que no se sepa leer se pinta como **ENVIADO**. Es el mismo defecto sobre si un cliente
 * recibió o no su mensaje.
 */
const CENSO_RESPALDOS = Object.freeze({
  'api.js': 2,                 // :1135 → M.pendiente_agendar · :1285 → map.sent
  'expensesView.js': 1,        // :12   → CATEGORY_LABELS.otros
  'jobsView.js': 1,            // :269  → JOB_STATE_META.pendiente_agendar
  'parteDetailView.js': 1,     // :279  → avisos.sin_lineas_reconocidas
});

test('SCRUM-748 · SUELO: el detector del censo encuentra y sabe decir que NO', () => {
  assert.equal(respaldosQueAfirman('const m = M[k] || M.verde;').length, 1,
    '🔴 CIEGO: no ve la forma exacta que cuenta. Su número no significaría nada.');
  // CONTROL NEGATIVO: las formas HONESTAS y las neutras no pueden entrar.
  for (const bueno of [
    'const m = M[k] || k;',                       // devuelve la clave: se ve el código
    'const m = M[k] || 0;',                       // neutro
    'const m = M[k] || {};',                      // neutro
    "const m = M[k] || { label: String(k) };",    // construye con la clave a la vista
    'const m = OTRO.x || M.verde;',               // no es un acceso indexado
  ]) {
    assert.deepEqual(respaldosQueAfirman(bueno), [],
      `🔴 FALSO POSITIVO: el censo acusa a una forma legítima:\n    ${bueno}`);
  }
});

test('SCRUM-748 · 🔴 el censo: nadie NUEVO convierte un desconocido en un estado concreto', () => {
  const ficheros = fs.readdirSync(DIR_JS).filter((f) => f.endsWith('.js'));
  assert.ok(ficheros.length >= 40, `🔴 CIEGO: sólo ${ficheros.length} ficheros en el dashboard.`);

  const actual = {};
  for (const f of ficheros) {
    const n = respaldosQueAfirman(fs.readFileSync(path.join(DIR_JS, f), 'utf8'), f).length;
    if (n) actual[f] = n;
  }

  const nuevos = Object.keys(actual).filter((f) => !(f in CENSO_RESPALDOS));
  assert.deepEqual(nuevos, [],
    '🔴 UN RESPALDO NUEVO QUE AFIRMA UN ESTADO:\n'
    + nuevos.map((f) => `   · ${f} (${actual[f]})`).join('\n')
    + '\n\n  `MAPA[x] || MAPA.algo` convierte «no sé qué es esto» en «es esto». Si hace falta un\n'
    + '  respaldo, que deje ver el código: `invoiceStatusMeta` en `api.js` enseña cómo.');

  // Y el trinquete aprieta dentro de cada uno: si un fichero censado gana otro, cae igual.
  for (const [f, n] of Object.entries(CENSO_RESPALDOS)) {
    assert.equal(actual[f] || 0, n,
      `🔴 \`${f}\` declaraba ${n} y ahora tiene ${actual[f] || 0}.`
      + ((actual[f] || 0) < n ? ' Si se ha ARREGLADO, baja el número en el mismo commit.' : ''));
  }

  // 🔴 Y EL DE ESTE TICKET NO PUEDE VOLVER: `invoicesView.js` no está en el censo, y si reapareciera
  // saldría por `nuevos`. Se comprueba explícito para que no dependa de leer bien la lista.
  assert.equal(actual['invoicesView.js'], undefined,
    '🔴 `invoicesView.js` ha vuelto a tener un respaldo que afirma un estado: es este ticket, otra vez.');
});

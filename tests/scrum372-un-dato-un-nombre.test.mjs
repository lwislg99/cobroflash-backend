// SCRUM-372 · UN DATO, UN NOMBRE.
//
// Sin gate: se DERIVA del árbol con el compilador de TypeScript. Ni BD, ni red, ni navegador.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO, Y POR QUÉ NO ERA COSMÉTICO
//
// `estadoCobroAlbaran(...)` devuelve UN derivado de tres valores —`sin_facturar` · `parcial` ·
// `facturado`— y se serializaba con DOS nombres según por qué endpoint entraras:
//
//     estadoFacturacion  →  albaranes.routes.ts  (detalle del albarán)
//     estadoCobro        →  albaranes.routes.ts (facturar-parcial) · jobs.routes.ts ·
//                           albaranesListado.ts
//
// Copiar el contexto de una vista a otra daba `undefined`, y **`undefined !== 'facturado'` es
// TRUE**: la fila ofrecía «facturar» sobre albaranes ya facturados del todo, sin error y sin que
// nada se pusiera rojo. Un botón que solo puede fallar, sobre el documento que cierra el cobro.
//
// Y había una segunda cara: `estadoCobro` YA nombraba OTRO dato —el cobro del TRABAJO,
// `Pagado` · `Parcial` · `Pendiente`, de `estadoCobroFor`— con otro juego de valores. Los dos
// convivían en `jobDetailView.js` a 300 líneas uno del otro. Por eso la unificación va hacia
// `estadoFacturacion` y no al revés: el otro nombre estaba ocupado.
//
// ⚠️ ESTE GUARD NO VIGILA UN NOMBRE BONITO. Vigila que el nombre no pueda VOLVER a bifurcarse:
// un productor nuevo que invente un tercer nombre reabre exactamente el mismo `undefined`.
import { test } from 'node:test';
import { soloEjecutable } from './_guard-texto.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const NOMBRE = 'estadoFacturacion';
const RETIRADO = 'estadoCobro';
const DERIVADOR = 'estadoCobroAlbaran';

function ficherosTs(dir = path.join(RAIZ, 'src'), out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficherosTs(p, out);
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}
const rel = (p) => path.relative(RAIZ, p).split(path.sep).join('/');

/**
 * Toda propiedad cuyo VALOR sea una llamada a `estadoCobroAlbaran(...)`, con el nombre bajo el que
 * se serializa. Por AST: un `grep` casaría con los comentarios que explican esto mismo.
 */
function serializaciones() {
  const out = [];
  let nodos = 0;
  for (const f of ficherosTs()) {
    const sf = ts.createSourceFile('x.ts', fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const L = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
    const visita = (n) => {
      nodos += 1;
      // `nombre: estadoCobroAlbaran(...)` — la forma directa.
      if (ts.isPropertyAssignment(n) && ts.isCallExpression(n.initializer)) {
        const e = n.initializer.expression;
        const fn = ts.isIdentifier(e) ? e.text : (ts.isPropertyAccessExpression(e) ? e.name.text : null);
        if (fn === DERIVADOR) out.push({ f: rel(f), l: L(n), campo: n.name.getText(sf), forma: 'directa' });
      }
      // `const x = estadoCobroAlbaran(...)` y luego `{ x }` — la forma con variable intermedia,
      // que es como estaba escrito el detalle del albarán. Sin esto el censo lo perdería.
      if (ts.isVariableDeclaration(n) && n.initializer && ts.isCallExpression(n.initializer)) {
        const e = n.initializer.expression;
        const fn = ts.isIdentifier(e) ? e.text : (ts.isPropertyAccessExpression(e) ? e.name.text : null);
        if (fn === DERIVADOR) out.push({ f: rel(f), l: L(n), campo: n.name.getText(sf), forma: 'variable' });
      }
      ts.forEachChild(n, visita);
    };
    visita(sf);
  }
  return { serializaciones: out, nodos };
}

// ── EL SUELO ────────────────────────────────────────────────────────────────────────────

test('SCRUM-372 · SUELO: el censo ENCUENTRA los productores del derivado', () => {
  const { serializaciones: s, nodos } = serializaciones();
  assert.ok(nodos > 5000, `🔴 ESCÁNER CIEGO: solo ${nodos} nodos recorridos en src/`);
  assert.ok(
    s.length >= 4,
    `🔴 ESCÁNER CIEGO: el censo ve ${s.length} productores y se midieron 4 ` +
      '(albaranes.routes.ts ×2, jobs.routes.ts, albaranesListado.ts).\n\n' +
      '  «Nadie serializa este derivado» y «no supe encontrarlos» son el mismo número y significan\n' +
      '  lo contrario. Con 0, el test de abajo pasaría por vacío.',
  );
});

// ── EL CORAZÓN: UN SOLO NOMBRE ──────────────────────────────────────────────────────────

test('SCRUM-372 · 🔴 el derivado se serializa SIEMPRE con el mismo nombre', () => {
  const { serializaciones: s } = serializaciones();
  const disidentes = s.filter((x) => x.campo !== NOMBRE);

  assert.deepEqual(
    disidentes.map((x) => `${x.f}:${x.l} → \`${x.campo}\``), [],
    `🔴 EL MISMO DATO VUELVE A VIAJAR CON MÁS DE UN NOMBRE.\n\n` +
      disidentes.map((x) => `   · ${x.f}:${x.l} lo serializa como \`${x.campo}\``).join('\n') + '\n\n' +
      `  Todos tienen que llamarlo \`${NOMBRE}\`. No es cosmética: quien copia el contexto de una\n` +
      '  vista a otra lee el nombre de LA SUYA, y un campo que no llega vale `undefined` —\n' +
      "  y `undefined !== 'facturado'` es TRUE. Se ofrece «facturar» sobre albaranes ya cerrados,\n" +
      '  sin error y sin que nada se ponga rojo.\n\n' +
      '  Si de verdad hace falta un nombre distinto, es que son DOS datos: sepáralos en el dominio\n' +
      '  primero, no en la serialización.',
  );
  assert.ok(s.length > 0, '🔴 ESCÁNER CIEGO: cero productores');
});

// ── EL HERMANO POSITIVO: EL DETECTOR VERÍA UN DISIDENTE ─────────────────────────────────

test('SCRUM-372 · SUELO DEL DETECTOR: reconocería un nombre disidente si lo hubiera', () => {
  // SCRUM-237: una negación sin hermano positivo pasa por vacío el día que el detector se rompe.
  // Se le da un fichero sintético con las DOS formas y se comprueba que las ve y las distingue.
  const falso = `
    const estadoOtroNombre = estadoCobroAlbaran(lineas, facturado, true);
    export const payload = { estadoTercerNombre: estadoCobroAlbaran(lineas, facturado) };
  `;
  const sf = ts.createSourceFile('falso.ts', falso, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const vistos = [];
  const visita = (n) => {
    if (ts.isPropertyAssignment(n) && ts.isCallExpression(n.initializer)
      && n.initializer.expression.getText(sf) === DERIVADOR) vistos.push(n.name.getText(sf));
    if (ts.isVariableDeclaration(n) && n.initializer && ts.isCallExpression(n.initializer)
      && n.initializer.expression.getText(sf) === DERIVADOR) vistos.push(n.name.getText(sf));
    ts.forEachChild(n, visita);
  };
  visita(sf);
  assert.deepEqual(
    vistos.sort(), ['estadoOtroNombre', 'estadoTercerNombre'],
    `🔴 ESCÁNER CIEGO: el detector no reconoce un nombre disidente (vio: ${JSON.stringify(vistos)}). ` +
      'Un guard que no puede ver lo que prohíbe siempre está verde.',
  );
});

// ── EL NOMBRE RETIRADO NO VUELVE POR EL LADO DEL ALBARÁN ────────────────────────────────

test('SCRUM-372 · `estadoCobro` ya NO se lee sobre un albarán en el dashboard', () => {
  // El vector real: el front leyendo el nombre del OTRO endpoint. `estadoCobro` sigue siendo
  // legítimo —es el cobro del TRABAJO— así que lo que se prohíbe es la lectura sobre un ALBARÁN,
  // no el token. Prohibir el token entero sería un rojo por código ajeno.
  const dir = path.join(RAIZ, 'public/dashboard/js');
  const ficheros = fs.readdirSync(dir).filter((f) => f.endsWith('.js'));
  assert.ok(ficheros.length > 10, `🔴 ESCÁNER CIEGO: solo ${ficheros.length} ficheros en el dashboard`);

  const culpables = [];
  let lineasMiradas = 0;
  for (const f of ficheros) {
    const lineas = fs.readFileSync(path.join(dir, f), 'utf8').split(/\r?\n/);
    lineas.forEach((linea, i) => {
      // Sin comentarios: un guard de texto se caza a sí mismo en el comentario que lo explica.
      const codigo = soloEjecutable(linea);
      lineasMiradas += 1;
      // `alb.estadoCobro`, `a.estadoCobro`, `f.estadoCobro` — el albarán. `job.`/`j.` es el Trabajo.
      if (new RegExp(`\\b(alb|albaran)\\.${RETIRADO}\\b`).test(codigo)) {
        culpables.push(`public/dashboard/js/${f}:${i + 1} — ${codigo.trim().slice(0, 90)}`);
      }
    });
  }
  assert.ok(lineasMiradas > 3000, `🔴 ESCÁNER CIEGO: solo ${lineasMiradas} líneas miradas`);

  assert.deepEqual(
    culpables, [],
    `🔴 EL DASHBOARD VUELVE A LEER \`${RETIRADO}\` SOBRE UN ALBARÁN:\n` +
      culpables.map((c) => `   · ${c}`).join('\n') + '\n\n' +
      `  Ese campo ya no llega: los cuatro productores sirven \`${NOMBRE}\`. Lo que llega es\n` +
      "  `undefined`, y `undefined !== 'facturado'` es TRUE — el defecto de SCRUM-372 entero.",
  );
});

test('SCRUM-372 · HERMANO POSITIVO: el detector SÍ vería `alb.estadoCobro`', () => {
  // Sin esto, la negación de arriba pasaría por vacío si el patrón dejara de casar nunca.
  const muestra = "if (alb.estadoCobro !== 'facturado') { pintar(); }";
  assert.ok(
    new RegExp(`\\b(alb|albaran)\\.${RETIRADO}\\b`).test(muestra),
    '🔴 ESCÁNER CIEGO: el detector no reconocería la lectura prohibida ni teniéndola delante.',
  );
  // Y el control negativo: la lectura LEGÍTIMA sobre el Trabajo no se marca.
  assert.ok(
    !new RegExp(`\\b(alb|albaran)\\.${RETIRADO}\\b`).test('const cls = cobroPillClass(job.estadoCobro);'),
    '🔴 el detector marca `job.estadoCobro`, que es OTRO dato y es legítimo. Un rojo por código ' +
      'ajeno es un rojo que alguien silencia.',
  );
});

// ── EL RESIDUO, DECLARADO ───────────────────────────────────────────────────────────────

test('SCRUM-372 · lo que el renombre NO arregla, sigue DICHO', () => {
  // Un nombre único quita el vector conocido, no la clase entera: leer un campo que el objeto no
  // trae sigue dando `undefined`, y `undefined !== 'facturado'` sigue siendo TRUE. Eso no puede
  // quedar solo en la cabeza de quien hizo el ticket.
  const vista = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/jobDetailView.js'), 'utf8');
  assert.match(
    vista, /LO QUE EL RENOMBRE \*\*NO\*\* ARREGLA/,
    '🔴 se ha borrado la advertencia de lo que el renombre NO cubre. El día que alguien lea un ' +
      'campo ausente volverá el mismo `undefined`, y nadie habrá avisado.',
  );
});

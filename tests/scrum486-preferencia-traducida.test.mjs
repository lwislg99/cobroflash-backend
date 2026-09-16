// SCRUM-486 · AL CREAR EL COBRO, `mp` NO SE TRADUCE A NINGÚN MÉTODO.
//
// Sin gate: AST + ejecución del traductor. Ni BD, ni red.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL DEFECTO, Y POR QUÉ NO SE VEÍA
//
// `charges.routes.ts` traducía la preferencia de entrada al vocabulario que se guarda:
//
//     methodPref === 'card' ? 'card' : methodPref === 'mp' ? 'mp' : 'transfer'
//
// Hacía `bank → transfer` y `card → card`… y dejaba `mp → mp` **sin traducir**. `'mp'` no está en
// `PAID_VIA`, así que entraba en la columna un valor que ningún camino puede interpretar.
//
// **Un traductor al que le falta una regla no se ve**: parece que ese caso no necesita traducción.
// Y el remate es que el arreglo de `bank → transfer` (SCRUM-474) se hizo EN ESA MISMA LÍNEA, tres
// tokens después, sin que el `mp` cantara.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA DECISIÓN (fundador, 12-ago-2026): EL DESCONOCIDO DECLARADO
//
// `mp` no se traduce a NINGÚN método. MercadoPago es una **pasarela**, no un método, y al CREAR el
// cobro nadie sabe con qué pagará el cliente. Traducirlo a `card` sería inventar el dato más
// probable — lo que la regla 22 prohíbe.
//
// ⚠️ Y el desconocido declarado **es un valor, no un NULL**: cabe en `Charge.method` tal como está
// (`String`, NOT NULL — medido). No hace falta schema.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
import { PAID_VIA } from '../dist/modules/billing/domain/paidVia.js';
import {
  METODO_DESCONOCIDO, esMetodoValido, metodoDesdePreferencia,
} from '../dist/modules/billing/domain/metodoDeCobro.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUTA = 'src/modules/billing/app/routes/charges.routes.ts';
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

// ── 🔴 EL CONTROL NEGATIVO VA PRIMERO ────────────────────────────────────────────────────

test('SCRUM-486 · 🔴 CONTROL NEGATIVO: `bank` y `card` se traducen EXACTAMENTE como antes', () => {
  // Lo primero, porque es lo que protege los cobros que hoy funcionan. Un arreglo del caso raro
  // que mueva el caso normal es un arreglo que hay que revertir el lunes.
  assert.equal(metodoDesdePreferencia('card'), 'card',
    '🔴 la preferencia `card` ha dejado de guardarse como `card`.');
  assert.equal(metodoDesdePreferencia('bank'), 'transfer',
    '🔴 `bank` ha dejado de traducirse a `transfer` — es el caso POR DEFECTO del contrato de '
    + 'entrada (SCRUM-474) y el más frecuente.');
  // El default del schema de entrada es `bank`: ausente y vacío tienen que caer donde caía `bank`.
  for (const v of [undefined, null, '', '   ', 'cualquier_cosa']) {
    assert.equal(metodoDesdePreferencia(v), 'transfer',
      `🔴 la preferencia ${JSON.stringify(v)} ya no cae en \`transfer\`: el caso por defecto se ha movido.`);
  }
  // Y lo que sale para los dos casos normales sigue siendo del conjunto cerrado, sin fricción.
  for (const pref of ['card', 'bank']) {
    assert.equal(esMetodoValido(metodoDesdePreferencia(pref)), true,
      `🔴 la preferencia \`${pref}\` produce un método que el validador rechaza: eso bloquearía un cobro real.`);
  }
});

// ── 🔴 EL VECTOR ─────────────────────────────────────────────────────────────────────────

test('SCRUM-486 · 🔴 `mp` se traduce al DESCONOCIDO DECLARADO, no a un método', () => {
  assert.equal(metodoDesdePreferencia('mp'), METODO_DESCONOCIDO,
    '🔴 LA PREFERENCIA `mp` NO SE ESTÁ DECLARANDO DESCONOCIDA.\n\n'
    + '  MercadoPago es una PASARELA, no un método: al crear el cobro nadie sabe con qué pagará el\n'
    + '  cliente. Si esto devuelve `mp`, entra en la columna un valor fuera de `PAID_VIA`; y si\n'
    + '  devuelve `card`, se inventa el dato más probable — que es lo que la regla 22 prohíbe.');
  assert.notEqual(metodoDesdePreferencia('mp'), 'mp', '🔴 `mp` vuelve a escribirse tal cual.');
  // El desconocido NO es un método válido, y esa distinción es todo el criterio.
  assert.equal(esMetodoValido(METODO_DESCONOCIDO), false,
    '🔴 el desconocido declarado ha entrado en el conjunto cerrado: dejaría de distinguirse de un '
    + 'método real, que es justo lo contrario de lo que dice.');
});

test('SCRUM-486 · 🔴 la ruta NO escribe ningún literal de método: usa el traductor', () => {
  const src = leer(RUTA);
  const sf = ts.createSourceFile('x.ts', src, ts.ScriptTarget.Latest, true);

  // Se busca la declaración de `method` en la ruta y se exige que salga del traductor.
  let decl = null;
  let linea = null;
  const visitar = (n) => {
    if (ts.isVariableDeclaration(n) && n.name.getText(sf) === 'method' && n.initializer) {
      decl = n.initializer.getText(sf).replace(/\s+/g, ' ');
      linea = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);

  assert.ok(decl, `🔴 no se encuentra la declaración de \`method\` en ${RUTA}: guard ciego.`);
  assert.match(decl, /metodoDesdePreferencia\(/,
    `🔴 ${RUTA}:${linea} VUELVE A TRADUCIR A MANO: \`${decl}\`.\n\n`
    + '  La traducción entera vive en `metodoDesdePreferencia`, junto al vocabulario que se guarda.\n'
    + '  Una ternaria aquí es como se perdió la regla de `mp`: a un traductor en línea al que le\n'
    + '  falta un caso no se le nota que le falta.');

  // 🔴 Y ningún literal fuera del conjunto en esa declaración, dicho aparte para que el rojo nombre
  // el valor si alguien vuelve a poner `'mp'`.
  for (const lit of [...String(decl).matchAll(/'([^']*)'/g)].map((m) => m[1])) {
    assert.ok(esMetodoValido(lit) || lit === METODO_DESCONOCIDO,
      `🔴 ${RUTA}:${linea} ESCRIBE EL MÉTODO «${lit}», QUE NO EXISTE.\n`
      + `  Válidos: ${PAID_VIA.join(', ')} (con pasarela opcional) o «${METODO_DESCONOCIDO}».`);
  }
});

// ── EL CENSO COMPLETO DE PUERTAS ─────────────────────────────────────────────────────────

/** Toda escritura de `Charge` del árbol, en las DOS formas. La abreviada también. */
function escriturasDeCharge() {
  const out = [];
  let ficheros = 0;
  const visitarDir = (dir) => {
    for (const e of fs.readdirSync(path.join(RAIZ, dir), { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) { if (!/node_modules|\.git|dist/.test(e.name)) visitarDir(p); continue; }
      if (!/\.(ts|mjs|js)$/.test(e.name)) continue;
      ficheros += 1;
      const src = fs.readFileSync(path.join(RAIZ, p), 'utf8');
      if (!/charge\.(create|update|updateMany|upsert)/.test(src)) continue;
      const sf = ts.createSourceFile('x.ts', src, ts.ScriptTarget.Latest, true);
      const visitar = (n) => {
        if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
            && /^(create|update|updateMany|upsert)$/.test(n.expression.name.text)
            && /charge$/i.test((n.expression.expression.getText(sf).split('.').pop() || ''))) {
          const arg = n.arguments[0];
          if (arg && ts.isObjectLiteralExpression(arg)) {
            const data = arg.properties.find((q) => q.name && q.name.getText(sf) === 'data');
            let metodo = null;
            if (data && ts.isPropertyAssignment(data) && ts.isObjectLiteralExpression(data.initializer)) {
              for (const q of data.initializer.properties) {
                if (!q.name || q.name.getText(sf) !== 'method') continue;
                metodo = ts.isShorthandPropertyAssignment(q) ? '<abreviada>'
                  : q.initializer.getText(sf).replace(/\s+/g, ' ');
              }
            }
            const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
            out.push({ fichero: p, linea: line + 1, op: n.expression.name.text, metodo });
          }
        }
        ts.forEachChild(n, visitar);
      };
      visitar(sf);
    }
  };
  visitarDir('src');
  visitarDir('scripts');
  return { escrituras: out, ficheros };
}

test('SCRUM-486 · el censo de escrituras de Charge está COMPLETO y cuadra', () => {
  const { escrituras, ficheros } = escriturasDeCharge();
  assert.ok(ficheros > 100, `🔴 ESCÁNER CIEGO: solo ${ficheros} ficheros recorridos.`);
  assert.ok(escrituras.length >= 11,
    `🔴 ESCÁNER CIEGO: ${escrituras.length} escrituras de Charge; el censo del 12-ago encontró ONCE.`);

  const con = escrituras.filter((e) => e.metodo !== null);
  const sin = escrituras.filter((e) => e.metodo === null);
  // La suma cuadra Y la lista se lee: lo primero no garantiza lo segundo.
  assert.equal(con.length + sin.length, escrituras.length,
    '🔴 las dos mitades del censo no suman su total.');
  assert.ok(con.some((e) => e.metodo === '<abreviada>'),
    '🔴 EL CENSO NO VE LA FORMA ABREVIADA (`method,`) — sumaría igual y clasificaría mal. Es el '
    + 'defecto exacto de mi primer censo: la suma cuadra y la lista miente.');
  assert.ok(con.length >= 6,
    `🔴 solo ${con.length} escrituras escriben \`method\` y eran SEIS.`);
});

test('SCRUM-486 · 🔴 NINGUNA puerta escribe un método que no existe', () => {
  // El cierre del conjunto: todo literal escrito en cualquier escritura de Charge, de todo el
  // árbol, es del conjunto cerrado o el desconocido declarado.
  const { escrituras } = escriturasDeCharge();
  const inventados = [];
  for (const e of escrituras) {
    const lit = (String(e.metodo || '').match(/^'([^']*)'$/) || [])[1];
    if (lit === undefined) continue;
    if (esMetodoValido(lit) || lit === METODO_DESCONOCIDO) continue;
    inventados.push(`${e.fichero}:${e.linea} [${e.op}] → '${lit}'`);
  }
  assert.deepEqual(inventados, [],
    `🔴 HAY UNA PUERTA QUE ESCRIBE UN MÉTODO INVENTADO:\n    ${inventados.join('\n    ')}\n\n`
    + `  Válidos: \`<metodo>[:<pasarela>]\` con metodo en PAID_VIA (${PAID_VIA.join(', ')}),\n`
    + `  o «${METODO_DESCONOCIDO}», que declara que no consta. Un valor inventado no es un hueco:\n`
    + '  es una atribución falsa y viaja al CSV del asesor pareciendo un dato bueno (SCRUM-191).');
});

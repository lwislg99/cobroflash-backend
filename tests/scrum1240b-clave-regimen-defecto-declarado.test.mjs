// tests/scrum1240b-clave-regimen-defecto-declarado.test.mjs — SCRUM-1240b (con SCRUM-1129)
//
// Sin gate: ni BD, ni red, ni `dist/`. Lee `src/` por AST (TypeScript), nunca por texto, y no
// importa ni modifica el camino de emisión (reglas 38 y 40: observar sin modificar).
//
// 🔴 ESTO NO ES UN VERDE QUE BENDICE EL '01'. Es un TRINQUETE DE UN DEFECTO CONOCIDO.
//
// Lo medido (SCRUM-1129, SCRUM-1240 y su registro): `registro.builder.ts` pone `claveRegimen` con
// `CLAVE_REGIMEN_GENERAL = '01'` fijo en todos los detalles de desglose, y en el builder no aparece
// `criterioCaja` ni ningún dato del régimen del comercio. Un merchant con criterio de caja tendría
// el libro registro «por caja» y el registro VERI*FACTU en `01`. Arreglarlo es STOP de regla 40
// (GO del fundador) y lo que tiene que hacer el arreglo lo dicen los tickets, no este fichero.
//
// Cómo trabaja, las dos mitades (A23 · 7):
//   · DECLARADO + defecto presente  → verde, y dice que es un defecto conocido, no una conformidad.
//   · DECLARADO + la clave cambió    → ROJO: alguien tocó la clave sin cerrar 1240/1129. Si es el
//     arreglo, el mismo cambio retira `DEFECTO_CONOCIDO` de aquí abajo; si no, es un cambio del
//     camino de emisión que nadie ha decidido.
//   · RETIRADO + defecto presente    → ROJO: se quitó la declaración y la clave sigue fija.
//   · RETIRADO + la clave cambió     → verde: este trinquete ha cumplido; el test del arreglo es
//     de quien lo construya.
//   · nada que medir (0 sitios o sin la constante) → CIEGO, que es ROJO, nunca verde.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const RAIZ = path.resolve(import.meta.dirname, '..');
const BUILDER = 'src/modules/fiscal/verifactu/registro.builder.ts';
const CONSTANTE = 'CLAVE_REGIMEN_GENERAL';
const CAMPO = 'claveRegimen';

/**
 * 🔴 LA DECLARACIÓN DEL DEFECTO. Quien arregle SCRUM-1240/1129 la retira EN EL MISMO CAMBIO
 * (borrándola o con `declarado: false`). Mientras esté, cualquier cambio de la clave tumba esto.
 */
export const DEFECTO_CONOCIDO = {
  declarado: true,
  tickets: ['SCRUM-1240', 'SCRUM-1129'],
  que: 'ClaveRegimen va fija a 01 en el builder VERI*FACTU: no depende de criterioCaja ni del régimen del comercio',
};

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // La clave del detalle sujeto pasa a depender de `criterioCaja`, sin retirar la declaración.
    fichero: BUILDER,
    de: '  return {\n    claveRegimen: CLAVE_REGIMEN_GENERAL,',
    a: "  return {\n    claveRegimen: (entrada as { criterioCaja?: boolean }).criterioCaja ? '07' : CLAVE_REGIMEN_GENERAL,",
    cae: 'SCRUM-1240b · la clave de régimen sigue siendo el defecto declarado',
  },
  {
    // Alguien cambia el valor fijo sin cerrar los tickets.
    fichero: BUILDER,
    de: "export const CLAVE_REGIMEN_GENERAL = '01';",
    a: "export const CLAVE_REGIMEN_GENERAL = '07';",
    cae: 'SCRUM-1240b · la clave de régimen sigue siendo el defecto declarado',
  },
];

const rel = (f) => path.relative(RAIZ, f).replace(/\\/g, '/');

function ficherosTs(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...ficherosTs(p));
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

/** Nombre de una propiedad o de un acceso, o null. */
function nombreDe(n) {
  return n && (ts.isIdentifier(n) || ts.isStringLiteral(n)) ? n.text : null;
}

/**
 * Mide la clave de régimen en unas fuentes `[{ ruta, texto }]`. Cuenta COSAS por AST:
 *   · sitios: cada escritura de `claveRegimen` (propiedad de objeto, abreviada o asignación);
 *     un sitio es FIJO sólo si vale el identificador `CLAVE_REGIMEN_GENERAL` y está en el builder;
 *   · la constante: el literal con que el builder declara `CLAVE_REGIMEN_GENERAL`;
 *   · `criterioCaja`: identificadores con ese nombre en el builder (los comentarios no son nodos).
 */
export function medirClaveRegimen(fuentes, builder = BUILDER) {
  const sitios = [];
  let constante = null;
  let criterioCaja = 0;
  for (const { ruta, texto } of fuentes) {
    const sf = ts.createSourceFile(ruta, texto, ts.ScriptTarget.Latest, true);
    const enBuilder = ruta === builder;
    const linea = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
    const sitio = (n, valor) => sitios.push({
      ruta, linea: linea(n), valor: valor ? valor.getText(sf) : '(abreviada)',
      fijo: enBuilder && !!valor && ts.isIdentifier(valor) && valor.text === CONSTANTE,
    });
    const ver = (n) => {
      if (ts.isPropertyAssignment(n) && nombreDe(n.name) === CAMPO) sitio(n, n.initializer);
      else if (ts.isShorthandPropertyAssignment(n) && n.name.text === CAMPO) sitio(n, null);
      else if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && (ts.isPropertyAccessExpression(n.left) || ts.isElementAccessExpression(n.left))
        && nombreDe(ts.isPropertyAccessExpression(n.left) ? n.left.name : n.left.argumentExpression) === CAMPO) {
        sitio(n, n.right);
      }
      if (enBuilder && ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === CONSTANTE) {
        constante = n.initializer && ts.isStringLiteral(n.initializer) ? n.initializer.text : '(no literal)';
      }
      if (enBuilder && ts.isIdentifier(n) && n.text === 'criterioCaja') criterioCaja += 1;
      ts.forEachChild(n, ver);
    };
    ver(sf);
  }
  let estado;
  if (!sitios.length || constante === null) estado = 'CIEGO';
  else if (sitios.every((s) => s.fijo) && constante === '01' && criterioCaja === 0) estado = 'DEFECTO';
  else estado = 'CAMBIADO';
  return { estado, sitios, constante, criterioCaja, poblacion: fuentes.length };
}

/** El veredicto del trinquete: `{ ok, motivo }`. */
export function juicio(medida, declaracion) {
  const declarado = declaracion?.declarado === true;
  const donde = medida.sitios.map((s) => `${s.ruta}:${s.linea} = ${s.valor}`).join(' · ') || '(ninguno)';
  if (medida.estado === 'CIEGO') {
    return { ok: false, motivo: `CIEGO: ${medida.sitios.length} escritura(s) de \`${CAMPO}\` y constante `
      + `${medida.constante ?? 'no encontrada'} sobre ${medida.poblacion} fichero(s). No mido nada, y eso no es un verde.` };
  }
  if (medida.estado === 'DEFECTO') {
    return declarado
      ? { ok: true, motivo: `DEFECTO CONOCIDO, declarado (${declaracion.tickets.join(', ')}): ${donde}. No es conformidad.` }
      : { ok: false, motivo: `Se retiró la declaración de SCRUM-1240/1129 y la clave sigue fija en '01': ${donde}. `
        + 'Retirarla es parte del arreglo, no lo sustituye.' };
  }
  return declarado
    ? { ok: false, motivo: `La clave de régimen ha CAMBIADO (constante '${medida.constante}', criterioCaja ×`
      + `${medida.criterioCaja}): ${donde}. El defecto de ${declaracion.tickets.join(' y ')} sigue declarado. `
      + 'Si es el arreglo, retira DEFECTO_CONOCIDO en este mismo cambio (lo que debe hacer lo dicen los tickets, '
      + 'y es STOP de regla 40: GO del fundador). Si no lo es, es un cambio del camino de emisión sin decidir.' }
    : { ok: true, motivo: `Declaración retirada y la clave ya no es la del defecto: ${donde}.` };
}

/** Las fuentes de `src/` que escriben, o podrían escribir, `claveRegimen`, más el builder siempre. */
function fuentesDeSrc() {
  const out = [];
  for (const f of ficherosTs(path.join(RAIZ, 'src'))) {
    const texto = fs.readFileSync(f, 'utf8');
    if (rel(f) === BUILDER || texto.includes(CAMPO)) out.push({ ruta: rel(f), texto });
  }
  return out;
}

test('SCRUM-1240b · la clave de régimen sigue siendo el defecto declarado', (t) => {
  const medida = medirClaveRegimen(fuentesDeSrc());
  t.diagnostic(`población: ${medida.poblacion} fichero(s) de src/ con \`${CAMPO}\` · ${medida.sitios.length} escritura(s) `
    + `· constante '${medida.constante}' · criterioCaja ×${medida.criterioCaja} en el builder · estado ${medida.estado}`);
  const v = juicio(medida, DEFECTO_CONOCIDO);
  t.diagnostic(v.motivo);
  assert.equal(v.ok, true, `🔴 ${v.motivo}`);
});

test('SCRUM-1240b · la declaración cita los dos tickets que la retiran', () => {
  if (DEFECTO_CONOCIDO?.declarado !== true) return; // retirada: no hay nada que citar
  assert.deepEqual([...DEFECTO_CONOCIDO.tickets].sort(), ['SCRUM-1129', 'SCRUM-1240']);
});

// ── Controles SEMBRADOS: el positivo lo fabrica el propio test, no se toma prestado del árbol ──
const defecto = [
  "export const CLAVE_REGIMEN_GENERAL = '01';",
  '// criterioCaja en un comentario no es un nodo',
  'export function f(e: { causa?: string }) {',
  "  if (e.causa === 'S2') return { claveRegimen: CLAVE_REGIMEN_GENERAL, calificacion: 'S2' };",
  "  return { claveRegimen: CLAVE_REGIMEN_GENERAL, calificacion: 'S1' };",
  '}',
].join('\n');
const sembrada = (texto, ruta = BUILDER) => medirClaveRegimen([{ ruta, texto }]);

test('SCRUM-1240b · control: el defecto sembrado se reconoce como DEFECTO', () => {
  const m = sembrada(defecto);
  assert.equal(m.estado, 'DEFECTO');
  assert.equal(m.sitios.length, 2);
  assert.equal(m.criterioCaja, 0, 'un comentario no cuenta como lectura de criterioCaja');
});

test('SCRUM-1240b · control: depender de criterioCaja, otra constante u otro escritor es CAMBIADO', () => {
  const caja = defecto.replace("  return { claveRegimen: CLAVE_REGIMEN_GENERAL,",
    "  return { claveRegimen: (e as { criterioCaja?: boolean }).criterioCaja ? '07' : CLAVE_REGIMEN_GENERAL,");
  assert.notEqual(caja, defecto, 'la siembra tiene que cambiar el fuente');
  assert.equal(sembrada(caja).estado, 'CAMBIADO');
  assert.equal(sembrada(defecto.replace("= '01'", "= '07'")).estado, 'CAMBIADO');
  const otro = medirClaveRegimen([{ ruta: BUILDER, texto: defecto },
    { ruta: 'src/x.ts', texto: "export const g = (d: any) => { d.claveRegimen = '07'; };" }]);
  assert.equal(otro.estado, 'CAMBIADO');
  assert.equal(otro.sitios.length, 3);
});

test('SCRUM-1240b · control: sin nada que medir dice CIEGO, no verde', () => {
  const vacio = sembrada('export const nada = 1;');
  assert.equal(vacio.estado, 'CIEGO');
  assert.equal(juicio(vacio, { declarado: true, tickets: ['SCRUM-1240', 'SCRUM-1129'] }).ok, false);
  assert.equal(juicio(vacio, undefined).ok, false);
  assert.equal(sembrada(defecto.replace("export const CLAVE_REGIMEN_GENERAL = '01';", '')).estado, 'CIEGO');
});

test('SCRUM-1240b · control: las cuatro casillas del juicio', () => {
  const dec = { declarado: true, tickets: ['SCRUM-1240', 'SCRUM-1129'] };
  const presente = sembrada(defecto);
  const cambiada = sembrada(defecto.replace("= '01'", "= '07'"));
  assert.deepEqual([
    juicio(presente, dec).ok, juicio(cambiada, dec).ok,
    juicio(presente, { ...dec, declarado: false }).ok, juicio(cambiada, undefined).ok,
  ], [true, false, false, true]);
});

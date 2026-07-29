// SCRUM-205 (guard estructural · sin gate: corre en `npm test`, no toca BD ni red).
//
// EL PUNTO DE NO RETORNO FISCAL LO ELIGE QUIEN EMITE, NUNCA EL CLIENTE FINAL.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO QUE CIERRA ESTO
//
// El sellado ocurría PEREZOSAMENTE dentro de `ensureInvoicePdf`: si la factura no tenía
// huella, se sellaba de camino al generar el PDF. Y uno de los llamadores de esa función es
// `GET /recibo/:token/pdf`, que es PÚBLICO. O sea que el instante EXACTO en que una factura
// entraba en la cadena VeriFactu —el punto de no retorno, lo que después solo se corrige con
// una R1— lo decidía **el cliente final abriendo su documento**.
//
// Además había otras cinco copias del mismo patrón (`try { sellar } catch { console.error }`)
// repartidas por los caminos de emisión, y una sexta escondida en `regenerate-pdf`: pedir la
// regeneración de un PDF metía la factura en la cadena.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTE GUARD SON DOS REGLAS Y NO UN MAPA DE ALCANZABILIDAD
//
// Mientras el sellado estaba esparcido por ocho sitios, contestar «¿puede una ruta pública
// provocar sellado?» exigía un análisis de alcanzabilidad transitiva. Al mover el sellado a UN
// solo sitio, la pregunta se vuelve local y la respuesta cabe en dos comprobaciones de árbol.
//
// Es la diferencia entre estudiar un problema y quitarlo: el mapa era caro PORQUE el diseño
// estaba mal. Arreglado el diseño, el guard es barato.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const SRC = path.join(RAIZ, 'src');

/** El ÚNICO sitio del proyecto autorizado a meter una factura en la cadena. */
const CASA_DEL_SELLADO = 'src/modules/invoicing/domain/selladoEstado.ts';
/** Donde vive la función de sellado en sí (su declaración, no su uso). */
const MOTOR = 'src/modules/invoicing/domain/verifactu.service.ts';

const SELLADORAS = ['applyVeriFactu', 'applyVeriFactuAnulacion'];
const PUERTA = 'sellarTrasEmision';

const rel = (p) => path.relative(RAIZ, p).split(path.sep).join('/');

function fuentesTs(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) fuentesTs(p, out);
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

/**
 * LLAMADAS (no imports, no comentarios) a un conjunto de funciones, por AST.
 *
 * AST y no `grep`: los nombres de estas funciones aparecen por fuerza en los comentarios que
 * explican la regla —incluido este fichero— y un guard de texto se cazaría a sí mismo. Es la
 * trampa que mordió cuatro veces en este repo (SCRUM-176/168/3/193).
 */
function llamadasA(nombres, ruta) {
  const codigo = fs.readFileSync(ruta, 'utf8');
  const sf = ts.createSourceFile(ruta, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const out = [];
  const visitar = (n) => {
    if (ts.isCallExpression(n)) {
      const c = n.expression;
      const nombre = ts.isPropertyAccessExpression(c) ? c.name.text : ts.isIdentifier(c) ? c.text : null;
      if (nombres.includes(nombre)) {
        out.push({ nombre, linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1 });
      }
    }
    ts.forEachChild(n, visitar);
  };
  ts.forEachChild(sf, visitar);
  return out;
}

const TODOS = fuentesTs(SRC);

// ── REGLA 1 · nadie sella salvo el punto único ────────────────────────────────────────────

test('SCRUM-205 · solo `sellarTrasEmision` mete una factura en la cadena', () => {
  const selladores = [];
  for (const p of TODOS) {
    const r = rel(p);
    if (r === MOTOR) continue; // ahí se DECLARAN; llamarse a sí mismas no cuenta
    for (const l of llamadasA(SELLADORAS, p)) selladores.push(`${r}:${l.linea} → ${l.nombre}()`);
  }

  // Guarda de presencia: si el escáner deja de encontrar el punto único, los asserts de abajo
  // pasarían en vacío. Cero llamadas no es «nadie sella», es «no he mirado».
  assert.ok(
    selladores.length > 0,
    '🔴 ESCÁNER CIEGO: ninguna llamada a applyVeriFactu en src/. Si el sellado cambió de ' +
      'nombre, este guard dejó de vigilar nada y hay que actualizarlo ANTES de fiarse del verde.',
  );

  const fuera = selladores.filter((s) => !s.startsWith(`${CASA_DEL_SELLADO}:`));
  assert.deepEqual(
    fuera,
    [],
    '🔴 HAY SELLADO FUERA DEL PUNTO ÚNICO:\n' + fuera.map((s) => `    ${s}`).join('\n') +
      `\n\n  Meter una factura en la cadena VeriFactu es el PUNTO DE NO RETORNO fiscal: después\n` +
      '  solo se corrige emitiendo una R1 (regla 29). Por eso ocurre en un único sitio, al\n' +
      `  EMITIR, y se llama con \`${PUERTA}()\` de ${CASA_DEL_SELLADO}.\n\n` +
      '  Si estás sellando desde otro lado, la pregunta no es «cómo lo añado a la lista»: es\n' +
      '  QUIÉN dispara ese camino. Cuando lo dispara el cliente final —abriendo su PDF, por\n' +
      '  ejemplo— el punto de no retorno deja de estar en manos de quien emite.',
  );
});

// ── REGLA 2 · generar un documento no sella ───────────────────────────────────────────────

test('SCRUM-205 · `ensureInvoicePdf` NO sella: generar un PDF no es emitir', () => {
  const lib = path.join(SRC, 'lib', 'invoicing.ts');
  assert.ok(fs.existsSync(lib), '🔴 ESCÁNER CIEGO: no encuentro src/lib/invoicing.ts');

  const llamadas = llamadasA([...SELLADORAS, PUERTA], lib);
  const sella = llamadas.filter((l) => SELLADORAS.includes(l.nombre));

  assert.deepEqual(
    sella.map((l) => `src/lib/invoicing.ts:${l.linea} → ${l.nombre}()`),
    [],
    '🔴 `ensureInvoicePdf` (o su fichero) HA VUELTO A SELLAR.\n\n' +
      '  Este es el defecto original de SCRUM-205: el sellado vivía dentro de la generación\n' +
      '  del PDF, y `GET /recibo/:token/pdf` —PÚBLICO— cuelga de ahí. Con eso, el momento en\n' +
      '  que una factura entra en la cadena lo elige el CLIENTE FINAL al abrir su documento.\n\n' +
      '  Si el PDF que se pide es de una factura sin sellar, eso es un ERROR, no una\n' +
      '  oportunidad de sellar: se corta con `puedeProducirDocumento()`.',
  );
});

// ── autoprueba: el guard sabe distinguir ──────────────────────────────────────────────────

test('SCRUM-205 (autoprueba) · el escáner ve una llamada de sellado sintética', () => {
  const tmp = path.join(RAIZ, 'tests', '__tmp-sellado-sintetico.ts');
  fs.writeFileSync(tmp, 'export async function x(i: any) { await applyVeriFactu(i, "B1", null as any); }\n');
  try {
    const encontradas = llamadasA(SELLADORAS, tmp);
    assert.equal(encontradas.length, 1, '🔴 el escáner NO ve una llamada de sellado');
    assert.equal(encontradas[0].nombre, 'applyVeriFactu');
  } finally {
    fs.rmSync(tmp, { force: true });
  }
});

test('SCRUM-205 (autoprueba) · un COMENTARIO que nombra la función no dispara el guard', () => {
  // La trampa clásica: el literal prohibido vive en la prosa que explica la prohibición —
  // este mismo fichero la nombra decenas de veces. El AST solo ve nodos.
  const tmp = path.join(RAIZ, 'tests', '__tmp-solo-comentario.ts');
  fs.writeFileSync(tmp, '// PROHIBIDO: no llames a applyVeriFactu aquí, usa sellarTrasEmision.\nexport const a = 1;\n');
  try {
    assert.deepEqual(llamadasA(SELLADORAS, tmp), []);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
});

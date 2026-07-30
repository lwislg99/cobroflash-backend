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

// ── REGLA 3 · quien emite, SELLA ──────────────────────────────────────────────────────────
//
// Las dos reglas de arriba vigilan una sola dirección: que nadie selle fuera del punto único.
// Esa dirección no ve el fallo simétrico, y el fallo simétrico es peor porque es MUDO: una
// factura que se emite y **nunca** se sella. Queda `pendiente_de_sellado`, sin PDF y sin QR, y
// el hueco solo se nota cuando el cliente pregunta por su factura.
//
// No es hipotético. Escribiendo este mismo ticket aparecieron DOS caminos así —`quotes.routes`
// (C1, el cliente final acepta el presupuesto) y `jobs.routes` (C2, cobrar el resto)—. Ninguno
// sellaba por su cuenta: los dos se apoyaban en el sellado PEREZOSO de `ensureInvoicePdf`, que
// es justo lo que SCRUM-205 quita. Se encontraron a mano, cruzando dos listas. Esta regla es
// para que el noveno camino no dependa de que alguien vuelva a cruzarlas.
//
// CÓMO: se sube desde cada `allocateInvoiceNumber()` por sus funciones ENVOLVENTES. Hay que
// subir porque el reparto real es `prisma.$transaction(async (tx) => { …allocate… })` y el
// sellado va FUERA de la transacción a propósito (`applyVeriFactu` lanza si recibe un cliente
// de transacción). Mirar "la misma función" y no subir daría rojo en los cuatro sitios buenos.
const DELEGA = {
  'src/modules/invoicing/domain/invoicing.service.ts':
    'emitInvoice es el helper COMPARTIDO: no abre la transacción ni la posee, la recibe. Sellar ' +
    'aquí sellaría dentro de la tx del llamador. Sus DOS llamadores sellan, y eso se comprueba ' +
    'abajo en vez de darse por supuesto.',
};
const LLAMADORES_DE_EMIT = [
  'src/modules/jobs/app/routes/albaranes.routes.ts',
  'src/modules/jobs/domain/recapitulativa.service.ts',
];

/** Funciones envolventes de cada llamada a `nombre`, de dentro hacia fuera. */
function envolventesDe(nombre, ruta) {
  const sf = ts.createSourceFile(ruta, fs.readFileSync(ruta, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const out = [];
  const esFuncion = (n) =>
    ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n);
  const visitar = (n, pila) => {
    const p = esFuncion(n) ? [...pila, n] : pila;
    if (ts.isCallExpression(n)) {
      const c = n.expression;
      const nm = ts.isPropertyAccessExpression(c) ? c.name.text : ts.isIdentifier(c) ? c.text : null;
      if (nm === nombre) out.push({ pila: p, linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1 });
    }
    ts.forEachChild(n, (h) => visitar(h, p));
  };
  ts.forEachChild(sf, (n) => visitar(n, []));
  return out;
}

/** ¿Alguna de estas funciones envolventes contiene una llamada a `nombre`? */
function algunaEnvolventeLlama(pila, nombre) {
  return pila.some((fn) => {
    let visto = false;
    const v = (n) => {
      if (ts.isCallExpression(n)) {
        const c = n.expression;
        const nm = ts.isPropertyAccessExpression(c) ? c.name.text : ts.isIdentifier(c) ? c.text : null;
        if (nm === nombre) visto = true;
      }
      ts.forEachChild(n, v);
    };
    ts.forEachChild(fn, v);
    return visto;
  });
}

test('SCRUM-205 · toda emisión termina en el punto de sellado (o delega, y se dice en quién)', () => {
  const huerfanas = [];
  let emisiones = 0;

  for (const p of TODOS) {
    const r = rel(p);
    for (const { pila, linea } of envolventesDe('allocateInvoiceNumber', p)) {
      emisiones += 1;
      if (DELEGA[r]) continue;
      if (!algunaEnvolventeLlama(pila, PUERTA)) huerfanas.push(`${r}:${linea}`);
    }
  }

  assert.ok(
    emisiones >= 7,
    `🔴 ESCÁNER CIEGO: solo veo ${emisiones} emisiones y SCRUM-203 midió 7. Si el embudo cambió ` +
      'de nombre, esta regla dejó de vigilar los caminos que dice vigilar.',
  );

  assert.deepEqual(
    huerfanas,
    [],
    '🔴 HAY EMISIÓN QUE NO SELLA:\n' + huerfanas.map((s) => `    ${s}`).join('\n') +
      '\n\n  Ahí se consume un número de la serie y se crea la factura, pero nadie la mete en la\n' +
      `  cadena. Se queda \`pendiente_de_sellado\`: sin PDF y sin QR, y en silencio.\n\n` +
      `  Antes esto "funcionaba" porque \`ensureInvoicePdf\` sellaba de camino al documento — o\n` +
      '  sea, el punto de no retorno lo disparaba quien abriese el PDF. Eso es el defecto que\n' +
      `  cierra SCRUM-205, no la solución. Llama a \`${PUERTA}()\` DESPUÉS del commit.`,
  );
});

test('SCRUM-205 · los llamadores de `emitInvoice` sellan (la delegación no es un agujero)', () => {
  for (const r of LLAMADORES_DE_EMIT) {
    const abs = path.join(RAIZ, r);
    assert.ok(fs.existsSync(abs), `🔴 ESCÁNER CIEGO: no encuentro ${r} — ¿se movió el llamador?`);
    assert.ok(
      llamadasA([PUERTA], abs).length > 0,
      `🔴 ${r} llama a \`emitInvoice\` y NO sella.\n\n` +
        `  \`emitInvoice\` está exento de la regla 3 PORQUE delega en sus llamadores. Si un\n` +
        '  llamador deja de sellar, la exención pasa de justificada a falsa y la emisión queda\n' +
        '  huérfana sin que nada lo diga.',
    );
  }
});

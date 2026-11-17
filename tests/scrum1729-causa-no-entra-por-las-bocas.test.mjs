// tests/scrum1729-causa-no-entra-por-las-bocas.test.mjs — SCRUM-1729 · guard de SOLO LECTURA
//
// QUÉ SE GUARDA (parte de SCRUM-1729, c.21959). De las bocas que llaman a `crearFacturaEmitida`,
// CUATRO son TRANSPARENTES a la línea: copian la línea del presupuesto con un spread
// (`lineasParaFacturar` / `stageLinesReconciled`) y NO llaman a `exigirDestinatarioParaIsp`:
//   · jobs.routes.ts        (facturar el trabajo)
//   · quotes.routes.ts      (cobro del presupuesto)
//   · quotesAdmin.routes.ts ×2 (tramo y factura entera)
// Hoy no pasa nada porque la línea del presupuesto NUNCA trae `causa`: la tiran dos puertas.
//   ① zod — `QuoteLineSchema` no declara `causa`, y `z.object` la BORRA.
//   ② `validarLineas` (albaranes) rehace la línea campo a campo y tampoco la copia.
// Si un día `causa` entra en `QuoteLineSchema`, una línea S2 (inversión del sujeto pasivo) se
// emitiría por esas cuatro bocas SIN comprobar que el cliente es empresario con NIF válido.
//
// 🔴 REGLA 38: este fichero SOLO LEE. No exporta nada nuevo ni toca una firma del camino:
//   - la puerta ① se alcanza por el esquema que YA se exporta (`CreateQuoteSchema.shape.lines`);
//   - la ② por `validarLineas`, que ya es `export`;
//   - las bocas se miran por AST (TypeScript), sin ejecutar nada del camino de emisión.
//
// Las tres preguntas:
//   1. ¿zod tira `causa`?                       (puerta ①, hoy SÍ)
//   2. ¿`validarLineas` tira `causa`?           (puerta ②, hoy SÍ)
//   3. TRINQUETE: si `causa` entra en `QuoteLineSchema` (por la clave o porque zod la deja pasar),
//      las 4 bocas transparentes tienen que llamar a `exigirDestinatarioParaIsp` → si no, ROJO.
//   + censo: el conjunto de ficheros que llaman a `crearFacturaEmitida` es el clasificado aquí.
//     Una boca nueva sin clasificar es ROJO (no se cuela en silencio por fuera del trinquete).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => path.relative(RAIZ, p).split(path.sep).join('/');

const { CreateQuoteSchema } = await import(pathToFileURL(path.join(RAIZ, 'dist/core/validation/schemas.js')).href);
const { validarLineas } = await import(pathToFileURL(path.join(RAIZ, 'dist/modules/jobs/domain/albaran.service.js')).href);

// ── AST ───────────────────────────────────────────────────────────────────────────────────────
function leerAst(relPath) {
  const abs = path.join(RAIZ, relPath);
  const texto = fs.readFileSync(abs, 'utf8');
  return ts.createSourceFile(abs, texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}
function nombreDeLlamada(nodo) {
  if (!ts.isCallExpression(nodo)) return null;
  const c = nodo.expression;
  if (ts.isIdentifier(c)) return c.text;
  if (ts.isPropertyAccessExpression(c)) return c.name.text;
  return null;
}
function llamadas(raiz, nombre) {
  const out = [];
  const visitar = (n) => { if (nombreDeLlamada(n) === nombre) out.push(n); ts.forEachChild(n, visitar); };
  visitar(raiz);
  return out;
}
/** La sentencia de nivel de fichero que contiene el nodo (el `router.post(...)` o la función). */
function sentenciaDeNivelSuperior(nodo) {
  let n = nodo;
  while (n.parent && !ts.isSourceFile(n.parent)) n = n.parent;
  return n;
}
const linea = (sf, nodo) => sf.getLineAndCharacterOfPosition(nodo.getStart(sf)).line + 1;

// ── La población ──────────────────────────────────────────────────────────────────────────────
// Las 4 bocas TRANSPARENTES del parte (c.21959), por fichero y número de llamadas.
const BOCAS_TRANSPARENTES = {
  'src/modules/jobs/app/routes/jobs.routes.ts': 1,
  'src/modules/quotes/app/routes/quotes.routes.ts': 1,
  'src/modules/system/app/routes/quotesAdmin.routes.ts': 2,
};
// El resto de quien llama a `crearFacturaEmitida`, con su motivo (allowlist VISIBLE, A23 #14).
const OTRAS_BOCAS = {
  'src/lib/invoicing.ts': 'cobro: llama a exigirDestinatarioParaIsp antes de pedir número (SCRUM-1051g)',
  'src/modules/system/app/routes/invoicesAdmin.routes.ts': 'factura manual: llama a exigirDestinatarioParaIsp (SCRUM-1051g)',
  'src/modules/invoicing/domain/invoicing.service.ts': 'emitInvoice (albaranes ×2, recapitulativa): rehacen la línea campo a campo, sin `causa` (parte c.21959)',
  'src/modules/invoicing/domain/crearFacturaEmitida.ts': 'la definición, no una boca',
};

function ficherosTs(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...ficherosTs(p));
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

/** Para cada boca transparente: ¿su sentencia de nivel superior llama a exigirDestinatarioParaIsp? */
function medirBocas() {
  const filas = [];
  for (const [f, esperadas] of Object.entries(BOCAS_TRANSPARENTES)) {
    const sf = leerAst(f);
    const llam = llamadas(sf, 'crearFacturaEmitida');
    assert.equal(llam.length, esperadas,
      `${f}: esperaba ${esperadas} llamada(s) a crearFacturaEmitida y hay ${llam.length}. ` +
      'La población del parte de SCRUM-1729 ha cambiado: se vuelve a medir, no se ajusta el número.');
    for (const c of llam) {
      const sent = sentenciaDeNivelSuperior(c);
      filas.push({ boca: `${f}:${linea(sf, c)}`, exige: llamadas(sent, 'exigirDestinatarioParaIsp').length > 0 });
    }
  }
  return filas;
}

function zodGuardaCausa() {
  const r = CreateQuoteSchema.shape.lines.unwrap().element.safeParse({ concept: 'Obra', qty: 1, price: 100, causa: 'S2' });
  assert.ok(r.success, `control: la línea mínima tiene que pasar el esquema (${JSON.stringify(r.error?.issues)})`);
  return Object.prototype.hasOwnProperty.call(r.data, 'causa');
}
function astDeclaraCausa() {
  const sf = leerAst('src/core/validation/schemas.ts');
  let claves = null;
  const visitar = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === 'QuoteLineSchema') {
      // `z.object({...})` puede ir encadenado (`.superRefine`): se busca el primer `z.object` dentro.
      const buscar = (m) => {
        if (claves) return;
        if (nombreDeLlamada(m) === 'object' && m.arguments[0] && ts.isObjectLiteralExpression(m.arguments[0])) {
          claves = m.arguments[0].properties.map((p) => p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? p.name.text : null);
          return;
        }
        ts.forEachChild(m, buscar);
      };
      buscar(n.initializer);
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  assert.ok(Array.isArray(claves) && claves.includes('concept'),
    'control: no encuentro `const QuoteLineSchema = z.object({...})` con `concept` en schemas.ts — el instrumento está CIEGO');
  return claves.includes('causa');
}

// ── 1 · puerta ① ──────────────────────────────────────────────────────────────────────────────
test('SCRUM-1729 · puerta ①: zod tira `causa` de la línea del presupuesto (y conserva lo declarado)', () => {
  const r = CreateQuoteSchema.shape.lines.unwrap().element.safeParse({
    concept: 'Obra', description: 'control positivo', qty: 1, price: 100, causa: 'S2',
  });
  assert.ok(r.success, JSON.stringify(r.error?.issues));
  // Control positivo: una clave DECLARADA y opcional sobrevive. Sin esto, «no hay causa» podría
  // ser un esquema que lo tira todo.
  assert.equal(r.data.description, 'control positivo');
  assert.equal(r.data.concept, 'Obra');
  assert.ok(!('causa' in r.data),
    'zod deja pasar `causa` en QuoteLineSchema. Las 4 bocas transparentes la llevarían a la factura ' +
    'sin exigirDestinatarioParaIsp. Abrir esta puerta es decisión (SCRUM-1729): el trinquete de abajo ' +
    'dice qué bocas faltan.');
});

// ── 2 · puerta ② ──────────────────────────────────────────────────────────────────────────────
test('SCRUM-1729 · puerta ②: validarLineas rehace la línea y no copia `causa` (VALORADO y SIN_VALORAR)', () => {
  const casos = [
    ['VALORADO', { concepto: 'Obra', cantidad: 2, unidad: 'ud', precioUnitario: 10, tipoIva: 21, causa: 'S2' }],
    ['SIN_VALORAR', { concepto: 'Obra', cantidad: 2, unidad: 'ud', causa: 'S2' }],
  ];
  for (const [modo, l] of casos) {
    const v = validarLineas([l], modo);
    assert.ok(v.ok, `${modo}: ${v.error}`);
    assert.equal(v.lineas.length, 1);
    assert.equal(v.lineas[0].concepto, 'Obra', `${modo}: control positivo`);
    assert.equal(v.lineas[0].cantidad, 2, `${modo}: control positivo`);
    assert.ok(!('causa' in v.lineas[0]), `${modo}: validarLineas deja pasar \`causa\` a Albaran.lineas`);
  }
});

// ── 3 · trinquete ─────────────────────────────────────────────────────────────────────────────
test('SCRUM-1729 · trinquete: si `causa` entra en QuoteLineSchema, las 4 bocas transparentes exigen destinatario', (t) => {
  const filas = medirBocas();
  assert.equal(filas.length, 4, `población: esperaba 4 bocas transparentes y medí ${filas.length}`);
  // Control positivo del instrumento: en la boca de cobro (`lib/invoicing.ts`) la llamada SÍ está,
  // en la misma función que crearFacturaEmitida. Si aquí sale «no», el AST está ciego y los
  // «exige=false» de abajo no dicen nada.
  {
    const sf = leerAst('src/lib/invoicing.ts');
    const llam = llamadas(sf, 'crearFacturaEmitida');
    assert.ok(llam.length > 0, 'control: no veo crearFacturaEmitida en src/lib/invoicing.ts');
    assert.ok(llam.every((c) => llamadas(sentenciaDeNivelSuperior(c), 'exigirDestinatarioParaIsp').length > 0),
      'control: el instrumento no ve exigirDestinatarioParaIsp en src/lib/invoicing.ts, donde está — CIEGO');
  }
  const entraPorZod = zodGuardaCausa();
  const entraPorClave = astDeclaraCausa();
  const sinExigir = filas.filter((f) => !f.exige).map((f) => f.boca);
  t.diagnostic(`población: ${filas.length} bocas · causa por zod=${entraPorZod} · por clave=${entraPorClave} · sin exigir=${sinExigir.length}`);
  for (const f of filas) t.diagnostic(`  ${f.boca} · exigirDestinatarioParaIsp=${f.exige}`);
  if (entraPorZod || entraPorClave) {
    assert.deepEqual(sinExigir, [],
      '`causa` ya entra en QuoteLineSchema, y estas bocas emiten la línea SIN exigirDestinatarioParaIsp ' +
      '(una línea S2 a un particular o sin NIF): ' + sinExigir.join(', ') + '. Se arregla la BOCA, no este test (regla 41).');
  }
});

// ── 4 · censo de bocas ────────────────────────────────────────────────────────────────────────
test('SCRUM-1729 · censo: quien llama a crearFacturaEmitida está clasificado', (t) => {
  const vistos = ficherosTs(path.join(RAIZ, 'src'));
  assert.ok(vistos.length > 100, `suelo: sólo vi ${vistos.length} ficheros .ts en src/`);
  const llaman = new Set();
  for (const abs of vistos) {
    const texto = fs.readFileSync(abs, 'utf8');
    if (!texto.includes('crearFacturaEmitida')) continue;
    const sf = ts.createSourceFile(abs, texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const r = rel(abs);
    if (llamadas(sf, 'crearFacturaEmitida').length > 0 || r.endsWith('/crearFacturaEmitida.ts')) llaman.add(r);
  }
  const clasificados = new Set([...Object.keys(BOCAS_TRANSPARENTES), ...Object.keys(OTRAS_BOCAS)]);
  t.diagnostic(`población: ${vistos.length} ficheros .ts · llaman a crearFacturaEmitida: ${llaman.size}`);
  const nuevos = [...llaman].filter((f) => !clasificados.has(f)).sort();
  const desaparecidos = [...clasificados].filter((f) => !llaman.has(f)).sort();
  assert.deepEqual(nuevos, [],
    'boca(s) nueva(s) de crearFacturaEmitida sin clasificar en SCRUM-1729: ¿copia la línea del presupuesto ' +
    'tal cual (transparente) o la rehace / exige destinatario? Se mide y se clasifica.');
  assert.deepEqual(desaparecidos, [],
    'una boca clasificada ya no llama a crearFacturaEmitida: el instrumento o el código cambió; se vuelve a medir.');
});

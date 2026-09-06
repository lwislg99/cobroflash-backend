// SCRUM-246 · SIN LÍNEAS CON IMPORTE NO SE PIDE NÚMERO (sin gate: AST sobre `src/`).
//
// El defecto: `applyVeriFactu` se niega a sellar una factura sin líneas, y varios caminos
// escribían `lines: scaledLines.length > 0 ? scaledLines : undefined`. Una factura fiscal sin
// líneas nace imposible de sellar y —desde SCRUM-205— tampoco puede producir documento.
//
// LA DECISIÓN, Y ES TODA LA REGLA: se comprueba **ANTES** de `allocateInvoiceNumber`. Después
// solo habría dos salidas y las dos son malas: modificar una factura ya numerada (regla 29) o
// deshacerla, y deshacer es lo que crea el HUECO en la serie que hay que justificar ante
// Hacienda. Comprobando antes no hay nada que deshacer.
//
// POR ESTRUCTURA Y NO POR LISTA: el guard no conoce los nombres de los caminos. Busca **toda**
// llamada a `allocateInvoiceNumber` y exige que su función tenga la comprobación por delante.
// El séptimo camino que alguien añada mañana entra solo, sin que nadie se acuerde de añadirlo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { bocasDeEmision, desprotegidas } from './_bocas-de-emision.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(RAIZ, 'src');

const EMBUDO = 'allocateInvoiceNumber';
const PORTON = 'exigirLineasFacturables';

/** Trinquete: llamadas a `emitInvoice` medidas el 6-sep-2026. No puede bajar sin anotarlo. */
const MINIMO_LLAMADORES_DE_EMIT = 4;

/**
 * ÚNICA exención, y se comprueba abajo en vez de suponerse.
 *
 * `emitInvoice` es el helper compartido: recibe la transacción y no la posee, y no ve las
 * líneas antes que su llamador. Delega, y por eso sus llamadores se verifican uno a uno.
 */
const DELEGA = {
  'src/modules/invoicing/domain/invoicing.service.ts':
    'emitInvoice es el helper compartido: sus DOS llamadores comprueban las líneas antes de '
    + 'llamarlo, y eso se verifica en el test siguiente.',
};
// 🔴 SCRUM-778 · AQUÍ HABÍA UNA LISTA CABLEADA DE DOS FICHEROS, Y EL ÁRBOL TIENE TRES.
//
// `invoicesAdmin.routes.ts` (la boca de la factura suelta) entró después y esta lista no creció.
// Peor: comprobaba POR FICHERO —«¿aparece el portón en algún sitio?»—, así que un fichero con dos
// bocas pasaba teniendo UNA protegida, y `albaranes.routes.ts` tiene dos.
//
// Provocado el 6-sep-2026 con una TERCERA llamada a `emitInvoice` sin portón en ese mismo
// fichero: este test pasaba en verde, 6/6. La población se deriva ahora del árbol y se comprueba
// POR LLAMADA — ver `tests/_bocas-de-emision.mjs` y `tests/scrum778-la-lista-cableada.test.mjs`.

const rel = (p) => path.relative(RAIZ, p).split(path.sep).join('/');
const fuentes = (d, out = []) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) fuentes(p, out);
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
};
const esFuncion = (n) =>
  ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n);
const nombreDe = (n) => {
  const c = n.expression;
  return ts.isPropertyAccessExpression(c) ? c.name.text : ts.isIdentifier(c) ? c.text : null;
};

/** Posición de la primera llamada a `nombre` dentro de un nodo, o null. */
function posicionDe(nodo, nombre) {
  let pos = null;
  const v = (n) => {
    if (ts.isCallExpression(n) && nombreDe(n) === nombre) {
      const p = n.getStart();
      if (pos === null || p < pos) pos = p;
    }
    ts.forEachChild(n, v);
  };
  ts.forEachChild(nodo, v);
  return pos;
}

/** Cada emisión, con la posición de su comprobación (si existe) en alguna envolvente. */
function emisiones() {
  const out = [];
  for (const p of fuentes(SRC)) {
    const arbol = ts.createSourceFile(p, fs.readFileSync(p, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const r = rel(p);
    const visitar = (n, pila) => {
      const nueva = esFuncion(n) ? [...pila, n] : pila;
      if (ts.isCallExpression(n) && nombreDe(n) === EMBUDO) {
        const posEmbudo = n.getStart();
        // La comprobación más cercana que esté ANTES, en cualquier envolvente.
        let posPorton = null;
        for (const fn of nueva) {
          const q = posicionDe(fn, PORTON);
          if (q !== null && q < posEmbudo && (posPorton === null || q > posPorton)) posPorton = q;
        }
        out.push({
          fichero: r,
          linea: arbol.getLineAndCharacterOfPosition(posEmbudo).line + 1,
          protegida: posPorton !== null,
        });
      }
      ts.forEachChild(n, (h) => visitar(h, nueva));
    };
    ts.forEachChild(arbol, (n) => visitar(n, []));
  }
  return out;
}

test('SCRUM-246 · ninguna emisión pide número sin comprobar que hay algo que cobrar', () => {
  const todas = emisiones();

  // SUELO: cero emisiones se lee igual que «todas protegidas». SCRUM-203 midió 7 creaciones.
  assert.ok(
    todas.length >= 7,
    `🔴 ESCÁNER CIEGO: veo ${todas.length} llamadas a \`${EMBUDO}\` y los caminos de emisión son 7. ` +
      'Si el embudo cambió de nombre, este guard dejó de vigilar y su verde no significa nada.',
  );

  const sinPorton = todas
    .filter((e) => !e.protegida && !DELEGA[e.fichero])
    .map((e) => `${e.fichero}:${e.linea}`);

  assert.deepEqual(
    sinPorton, [],
    '🔴 HAY UNA EMISIÓN QUE PIDE NÚMERO SIN COMPROBAR LAS LÍNEAS:\n' +
      sinPorton.map((s) => `    ${s}`).join('\n') +
      '\n\n  Una factura fiscal sin líneas con importe NO se puede sellar (`applyVeriFactu` la\n' +
      '  rechaza) y desde SCRUM-205 tampoco produce documento. Si el número ya se ha consumido\n' +
      `  cuando eso se descubre, las dos salidas son malas: modificar una factura numerada, o\n` +
      '  deshacerla y dejar un hueco en la serie que hay que justificar ante Hacienda.\n\n' +
      `  Llama a \`${PORTON}(lineas)\` ANTES del \`$transaction\`, no dentro y no después.`,
  );
});

test('SCRUM-246 · los llamadores de `emitInvoice` comprueban (la delegación no es un agujero)', () => {
  // SCRUM-778: población DERIVADA del árbol y comprobada POR LLAMADA, no por fichero.
  const bocas = bocasDeEmision({ raiz: RAIZ, porton: PORTON, cuando: 'antes' })
    .filter((b) => b.tipo === 'emisor');

  // SUELO: cero llamadores se lee igual que «todos comprueban». Y no puede encoger.
  assert.ok(bocas.length >= MINIMO_LLAMADORES_DE_EMIT,
    `🔴 ESCÁNER CIEGO: ${bocas.length} llamadas a \`emitInvoice\` y se midieron `
    + `${MINIMO_LLAMADORES_DE_EMIT} el 6-sep-2026. O el emisor cambió de nombre, o el barrido no `
    + 'está llegando a `src/` — y en los dos casos su verde no significa nada.');

  const fuera = desprotegidas(bocas);
  assert.deepEqual(
    fuera, [],
    '🔴 HAY UNA LLAMADA A `emitInvoice` QUE NO COMPRUEBA LAS LÍNEAS:\n    · ' + fuera.join('\n    · ')
      + '\n\n  `emitInvoice` está exento PORQUE delega: recibe la transacción y no ve las líneas\n'
      + '  antes que su llamador. Si un llamador deja de comprobar, la exención pasa de\n'
      + '  justificada a falsa y no hay nada que lo diga.\n\n'
      + `  Se comprueba POR LLAMADA: un fichero con dos bocas no queda cubierto porque UNA de las\n`
      + '  dos llame al portón (SCRUM-778).',
  );
});

// ── la regla en sí, ejercitada ────────────────────────────────────────────────────────────

test('SCRUM-246 · qué cuenta como «línea con importe»', async () => {
  const { hayLineasFacturables, exigirLineasFacturables, esErrorSinLineas, ERROR_SIN_LINEAS } =
    await import('../dist/modules/invoicing/domain/lineasFacturables.js');

  assert.equal(hayLineasFacturables(null), false, '🔴 null no tiene líneas');
  assert.equal(hayLineasFacturables([]), false, '🔴 una lista vacía no tiene líneas');
  assert.equal(hayLineasFacturables([{ qty: 1, price: 0 }]), false, '🔴 precio 0 no es importe');
  assert.equal(hayLineasFacturables([{ qty: 0, price: 100 }]), false, '🔴 cantidad 0 no es importe');
  assert.equal(hayLineasFacturables([{ qty: 1, price: 100 }]), true);

  // El caso que obliga a que sea «alguna» y no «todas»: una factura puede llevar un concepto a
  // 0 € (algo incluido) mientras el resto sí se cobra. Exigir que TODAS tengan importe
  // bloquearía facturas correctas.
  assert.equal(
    hayLineasFacturables([{ qty: 1, price: 0 }, { qty: 2, price: 50 }]), true,
    '🔴 una línea a 0 € junto a otras con importe NO invalida la factura',
  );

  // El fallback de `lib/invoicing.ts` con un cobro de 0 €: por eso ese camino tampoco es excepción.
  assert.equal(hayLineasFacturables([{ qty: 1, price: Number('0') }]), false);

  // LA RECTIFICATIVA, que es la razón de que la regla sea «distinto de cero» y no «mayor que».
  // Lo destapó el guard al llegar a `invoicesAdmin`: las líneas de una R1 son las de la original
  // con el precio NEGADO. Con `> 0` este guard habría bloqueado toda rectificativa — o sea, lo
  // único con lo que se corrige una factura ya emitida (regla 29).
  assert.equal(
    hayLineasFacturables([{ qty: 1, price: -100 }]), true,
    '🔴 una rectificativa mueve dinero en la otra dirección, pero lo mueve: es facturable',
  );

  let capturado = null;
  try { exigirLineasFacturables([]); } catch (e) { capturado = e; }
  assert.ok(capturado, '🔴 el portón NO lanzó sobre una lista vacía');
  assert.equal(capturado.code, ERROR_SIN_LINEAS);
  assert.ok(esErrorSinLineas(capturado));
  assert.ok(!esErrorSinLineas(new Error('otra_cosa')), '🔴 reconoce errores ajenos como suyos');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL GUARD DE JERGA · RE-ANCLADO EN SCRUM-264, Y ESTE COMENTARIO ESTÁ PARA QUE NADIE LO VUELVA
// A APRETAR
//
// La versión anterior prohibía una lista de palabras que incluía **«línea»**. Estaba mal anclado,
// y no por poco: «línea» es **la palabra del propio producto**. El botón del editor dice
// «Añadir línea» en cuatro pantallas (`quotesView`, `homeView`, `jobDetailView`,
// `aiQuoteAssistant`) y los mensajes hermanos de este mismo flujo la usan — «Añade al menos una
// línea con concepto y precio» y el aviso `ROJO_SIN_LINEAS` del semáforo fiscal, «Añade al menos
// una línea con su importe.».
//
// O sea que el guard empujaba contra el vocabulario que el usuario lee todos los días, y para
// pasarlo había que escribir peor. **Prohibir una palabra que el usuario ve en un botón no protege
// a nadie: fuerza un sinónimo peor.** Decisión del fundador, 3-ago-2026.
//
// LO QUE SÍ ES JERGA, y es lo que ahora se vigila: lo que el usuario **no ve nunca** en ninguna
// pantalla — identificadores de código, códigos de estado HTTP, literales de programación y los
// nombres internos del sistema (incluidos los fiscales que la regla 26 aparta del cliente).
//
// Y no es una lista de palabras que crece a mano: las tres primeras reglas son ESTRUCTURALES
// (forma de identificador, forma de código de estado, literales), así que cazan también el
// identificador que nadie ha escrito todavía.

/** Palabras que NO son jerga porque el usuario las ve en la interfaz. Declarado, no supuesto. */
export const VOCABULARIO_DEL_PRODUCTO = [
  'línea', 'concepto', 'precio', 'importe', 'presupuesto', 'factura', 'cobrar', 'firmar',
];

/** Nombres internos: aparatos del sistema y del canal fiscal que el usuario no debe leer. */
const NOMBRES_INTERNOS = [
  'verifactu', 'aeat', 'sif', 'xsd', 'soap', 'webhook', 'endpoint', 'token', 'api', 'json',
  'sql', 'prisma', 'merchant', 'serie', 'numeración', 'huella', 'importe bruto',
];

/**
 * Devuelve el trozo de jerga que contiene el texto, o `null` si está limpio.
 * Devuelve el TROZO y no un booleano para que el rojo diga qué sobra.
 */
export function jergaTecnicaEn(texto) {
  const t = String(texto);
  const estructurales = [
    [/\b[a-z]+(?:_[a-z0-9]+)+\b/, 'un identificador de código'],
    // Código de estado suelto, salvo que sea dinero: «400 €» es un importe, no un estado.
    [/\b[45]\d{2}\b(?!\s*(?:€|eur))/i, 'un código de estado HTTP'],
    [/\b(?:null|undefined|NaN)\b/, 'un literal de programación'],
  ];
  for (const [patron, queEs] of estructurales) {
    const m = t.match(patron);
    if (m) return `${m[0]} (${queEs})`;
  }
  const bajo = t.toLowerCase();
  for (const nombre of NOMBRES_INTERNOS) {
    if (new RegExp(`\\b${nombre}\\b`).test(bajo)) return `${nombre} (nombre interno del sistema)`;
  }
  return null;
}

test('SCRUM-246 · el copy no le habla al fontanero en jerga (regla 30)', async () => {
  const { COPY_ADMIN_SIN_LINEAS, COPY_PUBLICO_SIN_LINEAS } =
    await import('../dist/modules/invoicing/domain/lineasFacturables.js');

  for (const [quien, copy] of [['admin', COPY_ADMIN_SIN_LINEAS], ['público', COPY_PUBLICO_SIN_LINEAS]]) {
    const jerga = jergaTecnicaEn(copy);
    assert.equal(
      jerga, null,
      `🔴 el copy ${quien} dice «${jerga}». Lo lee un fontanero facturando, no un desarrollador.`,
    );
  }
  // El público NO puede pedirle al cliente que repita: su aceptación ya valió.
  assert.ok(
    !/vuelve a intentarlo|inténtalo/i.test(COPY_PUBLICO_SIN_LINEAS),
    '🔴 el copy público le pide al cliente que repita algo que ya hizo bien.',
  );
});

test('SCRUM-264 · el detector de jerga CAZA lo que tiene que cazar (control positivo)', () => {
  // Sin esto, re-anclar el guard podría haberlo dejado en nada y los dos copys pasarían por
  // limpios sin que nadie los mirase. Cada caso es uno que de verdad se ha visto en pantalla.
  for (const [texto, porque] of [
    ['factura_sin_lineas', 'el código que la landing le enseñaba al cliente (SCRUM-264)'],
    ['API 500: internal_error', 'lo que lee el pro cuando un catch no traduce'],
    ['Este merchant no tiene VeriFactu activo', 'dos nombres internos, uno del sistema y otro fiscal'],
    ['La respuesta vino null', 'un literal de programación'],
    ['Fallo 409 al emitir', 'un código de estado en la cara del usuario'],
  ]) {
    assert.notEqual(jergaTecnicaEn(texto), null, `🔴 se le escapa «${texto}»: ${porque}`);
  }
});

test('SCRUM-264 · y NO caza el vocabulario que el usuario ve en la pantalla', () => {
  // El otro lado del re-anclaje, y es el que motivó el cambio: estas frases son las que el
  // producto YA dice. Si alguna sale marcada, el guard vuelve a empujar hacia escribir peor.
  for (const frase of [
    'Añade al menos una línea con concepto y precio.',
    'Añade al menos una línea con su importe.',
    'No se puede facturar: este presupuesto no tiene ningún concepto con precio.',
    'Te enviaremos la factura en cuanto lo haga.',
    'Son 400 € en total.',
  ]) {
    assert.equal(
      jergaTecnicaEn(frase), null,
      `🔴 el guard marca como jerga «${frase}», que es lo que el producto dice en pantalla`,
    );
  }
  assert.ok(
    VOCABULARIO_DEL_PRODUCTO.includes('línea'),
    '🔴 «línea» ha salido del vocabulario del producto: es la palabra del botón «Añadir línea», ' +
      'y sacarla de aquí es el primer paso para volver a prohibirla.',
  );
});

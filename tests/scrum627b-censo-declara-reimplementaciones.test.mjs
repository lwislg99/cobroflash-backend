// tests/scrum627b-censo-declara-reimplementaciones.test.mjs — SCRUM-627 · OPCIÓN A
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL CENSO HERMANO: quien hace ARITMÉTICA DE IVA sin llamar a la primitiva también se declara.
//
// SCRUM-389 vigila a los que LLAMAN a `calcVatBreakdown`, y lo hace bien. Lo que no puede ver
// es a quien se lo escribe a mano: una reimplementación no llama a nadie. SCRUM-627 lo midió y
// lo demostró en las dos direcciones (`scrum627-censo-ciego.test.mjs`); esto es la opción A que
// el fundador aprobó el 25-ago-2026.
//
// 🔴 POR QUÉ UNA TABLA HERMANA Y NO UNA FILA MÁS EN LA DE SCRUM-389, que era la pregunta que el
// encargo mandaba parar a contestar:
//
//   El `CENSO` de SCRUM-389 es un objeto indexado POR RUTA. **No admite dos entradas para el
//   mismo fichero** — y hacen falta dos, porque `pdf.service.ts` tiene DOS COSAS DISTINTAS: una
//   llamada a la primitiva (para el presupuesto, SCRUM-604) que aquel censo ya clasifica, y
//   veinte líneas al lado que se escriben el desglose a mano. Es un límite real del formato.
//
//   No se fuerza: la segunda cosa vive aquí, y la entrada de allí lleva una remisión escrita a
//   esta tabla. Sin esa remisión, un lector de aquel censo ve el fichero clasificado y deja de
//   buscar — que es exactamente el defecto que este ticket persigue.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ HACE FALTA PARA PASAR
//
// Todo fichero que el detector por forma señale tiene que estar declarado en UNA de las dos
// tablas. Si no lo está, esto cae NOMBRÁNDOLO. No prohíbe nada: obliga a que alguien mire.
//
// La pregunta que responde cada veredicto es la de SCRUM-389, y no ha cambiado: **¿es una
// segunda cifra del mismo periodo?** Por documento es correcto y lo hace medio sistema; agregar
// un periodo por un camino propio es lo que no vale.
// ─────────────────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { analizarFuente, censarAritmeticaIva, criterioDe389 } from './_censo-aritmetica-iva.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');

/**
 * LOS DIEZ VEREDICTOS. Escritos mirando el código, no la ruta.
 *
 * `ademasDe389: true` marca los ficheros que TAMBIÉN están en el censo de llamadores: su entrada
 * aquí describe **otra cosa** del mismo fichero, y por eso tiene que decir cuál.
 */
const CENSO_ARITMETICA = {
  // ── Los que NO llaman a la primitiva: invisibles para SCRUM-389 hasta hoy ──────────────
  'src/core/utils/utils.ts': {
    veredicto: 'DOCUMENTO',
    nota: '`calcTotal` suma el bruto con IVA de las líneas de UN documento y redondea UNA vez al final. '
      + 'No agrupa por tipo y no mira periodos: es el total de lo que tiene delante.',
  },
  'src/core/validation/schemas.ts': {
    veredicto: 'NO_ES_DINERO',
    nota: 'La única aritmética es `Math.round(Number(linea.tax) * 100)` DENTRO del mensaje de error de '
      + 'la validación del suplido, para poder decir «un IVA del 21 %». Convierte una fracción en un '
      + 'porcentaje para NOMBRARLO; no deriva ningún importe.',
  },
  'src/modules/expenses/domain/justificante.ts': {
    veredicto: 'COMPROBACION',
    nota: 'Recalcula la cuota ESPERADA de un gasto (`base * vatRate / 100`) para compararla con la '
      + 'declarada y detectar que el justificante no cuadra, con tolerancia en céntimos. No produce '
      + 'ninguna cifra que salga en un documento, y además es IVA SOPORTADO, no repercutido: no entra '
      + 'en la casilla que el censo protege.',
  },
  'src/modules/invoicing/domain/recargoEquivalencia.ts': {
    veredicto: 'DOCUMENTO',
    nota: 'Calcula la cuota del RECARGO DE EQUIVALENCIA sobre una base (`b * tipoRecargo / 100`). Es otro '
      + 'impuesto, con su propia tabla de tipos, y por documento. El fichero ya declara por escrito que '
      + 'lee la FORMA de `calcVatBreakdown` sin importarlo — «leído, nunca importado».',
  },
  'src/modules/jobs/domain/albaran.service.ts': {
    veredicto: 'DOCUMENTO',
    nota: 'El valorado de UN albarán, en céntimos y redondeando por línea. Acumula UNA base y UNA cuota, '
      + 'no una por tipo: no es un desglose. ⚠️ El sub-rótulo del detector no lo marca como desglose '
      + 'porque sus acumuladores se llaman `baseCents`/`cuotaCents` y el reconocedor de nombres no '
      + 'admite sufijos — límite conocido del SUB-RÓTULO, no del censo: el fichero está declarado igual.',
  },
  'src/modules/jobs/domain/albaranAFactura.ts': {
    veredicto: 'DOCUMENTO',
    nota: '`totalDeFacturables`: el total en céntimos de lo facturable de UN albarán, redondeando POR '
      + 'LÍNEA a propósito — su propio comentario explica que dos formas de redondear la misma factura '
      + 'dan importes distintos, que es la lección de SCRUM-627 dicha antes de tiempo.',
  },
  'src/modules/quotes/app/routes/quotes.routes.ts': {
    veredicto: 'DOCUMENTO',
    nota: '`calcTierTotal`: el total de UNA opción (tier) de UN presupuesto. Un presupuesto ni siquiera '
      + 'entra en el 303.',
  },
  'src/modules/system/app/routes/customerPortal.routes.ts': {
    veredicto: 'DOCUMENTO',
    nota: 'Pinta el importe de cada línea en el portal del cliente. Es PRESENTACIÓN de un documento que '
      + 'ya existe; no suma nada que no esté ya en él.',
  },

  // ── Los que TAMBIÉN están en SCRUM-389, y aquí se declara la OTRA cosa ─────────────────
  'src/modules/invoicing/domain/vat.service.ts': {
    veredicto: 'PRIMITIVA', ademasDe389: true,
    nota: 'Está en el censo de llamadores porque `calcVatCuotaTotal` la llama. Su entrada AQUÍ es por su '
      + 'ARITMÉTICA: es la única que agrupa por tipo con derecho a hacerlo, porque ES el desglose. Que '
      + 'aparezca marcada como «desglose completo» no es un hallazgo: es el control de que el detector '
      + 'reconoce lo que dice reconocer.',
  },
  'src/modules/invoicing/infra/pdf/pdf.service.ts': {
    veredicto: 'REIMPLEMENTACION', ademasDe389: true,
    nota: '🔴 DOS COSAS DISTINTAS EN EL MISMO FICHERO, y ésta es la razón de ser de esta tabla. '
      + '(1) Una LLAMADA a la primitiva para el desglose del PRESUPUESTO (SCRUM-604): eso es lo que '
      + 'SCRUM-389 clasifica como DOCUMENTO. (2) Veinte líneas al lado —el bloque de totales de la '
      + 'FACTURA— que agrupan por tipo con su propio `vatMap` y NO llaman a nadie. El veredicto de allí '
      + 'cubre la llamada y NO cubre estas veinte líneas. '
      + 'NO se convierte a la primitiva: eso es la opción B, mueve un céntimo en el 25 % de los '
      + 'documentos de dos tipos (medido) y son las mismas veinte líneas de SCRUM-623 y SCRUM-624, '
      + 'parados esperando a la asesoría. Aquí se DECLARA, para que no aparezca una segunda.',
  },
};

const VEREDICTOS = ['DOCUMENTO', 'PRIMITIVA', 'REIMPLEMENTACION', 'COMPROBACION', 'NO_ES_DINERO', 'PERIODO'];

/** Las claves de la tabla `CENSO` de SCRUM-389, leídas de su fuente. */
function censo389() {
  const fuente = fs.readFileSync(path.join(RAIZ, 'tests/scrum389-censo-vat.test.mjs'), 'utf8');
  const sf = ts.createSourceFile('scrum389.test.mjs', fuente, ts.ScriptTarget.Latest, true);
  const claves = [];
  (function rec(n) {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === 'CENSO' && n.initializer) {
      (function rec2(x) {
        if (ts.isPropertyAssignment(x) && x.name && ts.isStringLiteral(x.name)) claves.push(x.name.text);
        x.forEachChild(rec2);
      })(n.initializer);
    }
    n.forEachChild(rec);
  })(sf);
  return claves;
}

/**
 * LA REGLA, en una función pura para poder probarla sin tocar `src/`.
 * Un fichero con aritmética de IVA está cubierto si lo declara ALGUNA de las dos tablas.
 */
export function sinDeclarar(hallazgos, mio, claves389) {
  return hallazgos.filter((h) => !mio[h.ruta] && !claves389.includes(h.ruta)).map((h) => h.ruta);
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// SUELO
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-627b · SUELO: el detector ve el árbol y el censo de al lado se deja leer', () => {
  const r = censarAritmeticaIva(RAIZ);
  assert.ok(r.ficherosMirados >= 200, `🔴 DETECTOR CIEGO: sólo veo ${r.ficherosMirados} ficheros`);
  assert.ok(r.hallazgos.length >= 15, `🔴 DETECTOR CIEGO: sólo ${r.hallazgos.length} hallazgos`);
  assert.ok(censo389().length >= 8, '🔴 NO SUPE LEER el censo de SCRUM-389: sin él no sé qué está ya cubierto');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// LA REGLA
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-627b · 🔴 todo el que hace aritmética de IVA está DECLARADO en una de las dos tablas', () => {
  const nuevos = sinDeclarar(censarAritmeticaIva(RAIZ).hallazgos, CENSO_ARITMETICA, censo389());
  assert.deepEqual(nuevos, [],
    `🔴 HAY ARITMÉTICA DE IVA SIN CLASIFICAR:\n   · ${nuevos.join('\n   · ')}\n\n`
    + '  Derivar IVA no está prohibido: por DOCUMENTO es lo correcto y lo hace medio sistema. Lo que\n'
    + '  no vale es que aparezca uno SIN QUE NADIE LO MIRE — y un sitio que se lo calcula a mano no\n'
    + '  llama a nadie, así que el censo de llamadores (SCRUM-389) no puede verlo.\n\n'
    + '  Si el tuyo agrega un PERIODO, que lea el LIBRO (`leerLibroRegistro`). Si es por documento,\n'
    + '  o es una comprobación, o no es dinero, declÁralo aquí con su motivo.');
});

test('SCRUM-627b · la tabla no describe ficheros que ya no tienen aritmética (trinquete)', () => {
  const vistos = new Set(censarAritmeticaIva(RAIZ).hallazgos.map((h) => h.ruta));
  const sobrantes = Object.keys(CENSO_ARITMETICA).filter((f) => !vistos.has(f));
  assert.deepEqual(sobrantes, [],
    `🔴 estas entradas ya no corresponden a nada: ${sobrantes.join(', ')}.\n`
    + '  O alguien lo arregló —y hay que borrar la entrada EN EL MISMO COMMIT, para que quede la\n'
    + '  mejora anotada— o el detector se ha quedado ciego. «Cero» y «no supe mirar» no son el mismo número.');
});

test('SCRUM-627b · los veredictos son del vocabulario cerrado y traen motivo', () => {
  for (const [f, e] of Object.entries(CENSO_ARITMETICA)) {
    assert.ok(VEREDICTOS.includes(e.veredicto), `🔴 ${f}: veredicto «${e.veredicto}» fuera del vocabulario`);
    assert.ok(e.nota && e.nota.length >= 80,
      `🔴 ${f}: el motivo es demasiado corto para ser un juicio. Un veredicto sin motivo es una etiqueta.`);
  }
});

test('SCRUM-627b · 🔴 los que están en LAS DOS tablas lo dicen, y dicen qué otra cosa son', () => {
  const claves = censo389();
  for (const [f, e] of Object.entries(CENSO_ARITMETICA)) {
    const enAmbas = claves.includes(f);
    assert.equal(!!e.ademasDe389, enAmbas,
      `🔴 ${f}: ${enAmbas
        ? 'está también en el censo de SCRUM-389 y su entrada aquí NO lo declara. Sin ese aviso, un '
          + 'lector de aquella tabla lo ve clasificado y da por mirado lo que hay al lado.'
        : 'se declara como «además de 389» pero allí no está.'}`);
  }
  // Y son exactamente los dos que hacen aritmética Y llaman.
  const dobles = Object.entries(CENSO_ARITMETICA).filter(([, e]) => e.ademasDe389).map(([f]) => f).sort();
  assert.deepEqual(dobles, [
    'src/modules/invoicing/domain/vat.service.ts',
    'src/modules/invoicing/infra/pdf/pdf.service.ts',
  ], '🔴 cambió quién tiene dos entradas: mírelo, porque es el caso que este censo existe para cubrir');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// EL CONTROL QUE DECIDE · una reimplementación NO declarada tiene que CAER, y nombrarse
// ─────────────────────────────────────────────────────────────────────────────────────────
const REIMPLEMENTACION = `
export function desgloseAMano(lineas: Array<{ qty: number; price: number; tax: number }>) {
  const mapa: Record<string, { base: number; vat: number }> = {};
  let subtotal = 0;
  for (const l of lineas) {
    const t = Number(l.tax) || 0;
    const base = Number(l.qty) * Number(l.price);
    subtotal += base;
    if (!mapa['x']) mapa['x'] = { base: 0, vat: 0 };
    mapa['x'].base += base;
    mapa['x'].vat += base * t;
  }
  return { mapa, subtotal };
}
`;

test('SCRUM-627b · 🔴 una reimplementación NUEVA y sin declarar cae, y el rojo la nombra', () => {
  const a = analizarFuente(REIMPLEMENTACION, 'src/modules/inventado/desgloseAMano.ts');
  assert.equal(a.desgloseCompleto, true, '🔴 el detector no la ve: sin eso este censo no vigila nada');
  assert.equal(criterioDe389(a), false, 'no llama a nadie — por eso SCRUM-389 no puede verla');

  const nuevos = sinDeclarar(
    [{ ruta: 'src/modules/inventado/desgloseAMano.ts', ...a }],
    CENSO_ARITMETICA, censo389(),
  );
  assert.deepEqual(nuevos, ['src/modules/inventado/desgloseAMano.ts'],
    '🔴 EL CENSO NO LA CAZA. Es el control que decide: si una reimplementación nueva no aparece '
    + 'aquí, la opción A no sirve para nada.');
});

test('SCRUM-627b · CONTROL NEGATIVO: un fichero declarado NO se reporta como nuevo', () => {
  // Sin esto, un censo que dijera «sin declarar» a todo pasaría el test de arriba.
  const yaDeclarado = [{ ruta: 'src/core/utils/utils.ts' }, { ruta: 'src/modules/invoicing/domain/libroRegistro.ts' }];
  assert.deepEqual(sinDeclarar(yaDeclarado, CENSO_ARITMETICA, censo389()), [],
    '🔴 el censo reporta como sin declarar algo que SÍ está declarado — en la tabla propia o en la de 389');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// REGRESIÓN · el falso positivo del alias no puede volver
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-627b · un objeto que TIENE un impuesto no convierte la variable en un impuesto', () => {
  // `let line = { concept, qty, price, tax: 0 }` hacía que `line.price * line.qty` saliera marcada:
  // el alias nacía del NOMBRE de la propiedad. Costó un falso positivo (`maintenance.service.ts`).
  const a = analizarFuente(`
export function precio(plan: { title: string }) {
  let line = { concept: plan.title, qty: 1, price: 0, tax: 0 };
  return Number(line.price) * Number(line.qty);
}
`, 'src/falsoPositivo.ts');
  assert.equal(a.alias.includes('line'), false,
    `🔴 \`line\` ha vuelto a ser alias de un impuesto (alias: ${a.alias.join(', ')}). El falso positivo ha vuelto.`);
  assert.deepEqual([a.desglose.length, a.bruto.length, a.conversion.length, a.otro.length], [0, 0, 0, 0],
    '🔴 vuelve a marcarse aritmética de IVA donde sólo hay precio × cantidad');

  // Y el CONTROL de que el arreglo no se pasó de frenada: el VALOR sí cuenta.
  const b = analizarFuente(`
export function cuota(base: number, tipo: number) {
  const linea = { concept: 'x', tax: tipo };
  return base * linea.tax;
}
`, 'src/siEsImpuesto.ts');
  assert.ok(b.otro.length + b.desglose.length + b.bruto.length >= 1,
    '🔴 el arreglo se pasó: ahora tampoco ve `base * linea.tax`, que SÍ es aritmética de IVA');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LA REMISIÓN, ATADA · lo que convierte un comentario en un mecanismo
//
// El comentario que se dejó en `scrum389-censo-vat.test.mjs` —«este fichero tiene dos cosas, la
// otra está en la tabla hermana»— es lo único que lleva a un lector de aquel censo hasta éste.
// Y hasta aquí NADIE LO LEÍA: borrarlo dejaba la tanda entera en verde. Era una nota, y en esta
// casa está fichado que una nota a mano no sostiene nada.
//
// Peor todavía, y es lo que hace que esto merezca existir: el veredicto `REIMPLEMENTACION` de
// `pdf.service.ts` tampoco estaba atado a lo que el detector encuentra. O sea que el día que ese
// bloque deje de reimplementar —cuando se ejecute la opción B— **el veredicto y la remisión
// mentirían LOS DOS A LA VEZ, y en el mismo sentido**. Su acuerdo se leería como confirmación:
// dos instrumentos que se corroboran entre sí sin tocar la realidad.
//
// Las dos direcciones, y las dos tienen que poder caer:
//
//   ① el puntero existe  ⟺  hay una entrada con veredicto REIMPLEMENTACION para ese fichero
//   ② ese veredicto sólo se admite MIENTRAS el detector siga marcándolo como desglose completo
// ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * El nombre de ESTE fichero, derivado. Si alguien lo renombra, el puntero de `scrum389` deja de
 * nombrarlo y ① cae pidiendo que se actualice — que es lo correcto: un puntero a un fichero que
 * ya no se llama así es exactamente la nota que miente.
 */
const YO = path.basename(import.meta.filename);

/**
 * Cuántos CARACTERES de comentario pegado sabe extraer el lector del `CENSO` de SCRUM-389.
 *
 * Se mide en caracteres y no en número de entradas, y no es un detalle: puse primero un suelo de
 * «al menos 3 entradas con comentario» A OJO, y la realidad medida son **2** de 12 — la mayoría
 * de las filas de aquel censo son de una línea. El suelo caía en árbol limpio por un número que
 * me inventé. Lo que el suelo tiene que distinguir es **0 contra algo**: si el lector extrae
 * 1.560 caracteres no está ciego, y cuántas filas los lleven es cosa de quien escriba allí.
 */
function charsDeComentario() {
  const ruta = path.join(RAIZ, 'tests/scrum389-censo-vat.test.mjs');
  const texto = fs.readFileSync(ruta, 'utf8');
  const sf = ts.createSourceFile('scrum389.test.mjs', texto, ts.ScriptTarget.Latest, true);
  let n = 0;
  (function rec(nodo) {
    if (ts.isVariableDeclaration(nodo) && ts.isIdentifier(nodo.name) && nodo.name.text === 'CENSO' && nodo.initializer) {
      (function rec2(x) {
        if (ts.isPropertyAssignment(x) && x.name && ts.isStringLiteral(x.name)) {
          const rangos = ts.getLeadingCommentRanges(texto, x.getFullStart()) || [];
          n += rangos.reduce((a, r) => a + (r.end - r.pos), 0);
        }
        x.forEachChild(rec2);
      })(nodo.initializer);
    }
    nodo.forEachChild(rec);
  })(sf);
  return n;
}

/** Los ficheros del `CENSO` de SCRUM-389 cuyos comentarios PEGADOS remiten a este censo. */
function remisionesEn389() {
  const ruta = path.join(RAIZ, 'tests/scrum389-censo-vat.test.mjs');
  const texto = fs.readFileSync(ruta, 'utf8');
  const sf = ts.createSourceFile('scrum389.test.mjs', texto, ts.ScriptTarget.Latest, true);
  const con = new Set();
  (function rec(n) {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === 'CENSO' && n.initializer) {
      (function rec2(x) {
        if (ts.isPropertyAssignment(x) && x.name && ts.isStringLiteral(x.name)) {
          // Los comentarios que van PEGADOS a esta entrada — no en cualquier sitio del fichero.
          // Una remisión suelta al final no lleva a nadie desde la fila que se está leyendo.
          const rangos = ts.getLeadingCommentRanges(texto, x.getFullStart()) || [];
          const pegado = rangos.map((r) => texto.slice(r.pos, r.end)).join('\n');
          if (pegado.includes(YO)) con.add(x.name.text);
        }
        x.forEachChild(rec2);
      })(n.initializer);
    }
    n.forEachChild(rec);
  })(sf);
  return con;
}

test('SCRUM-627b · 🔴 ① la remisión en SCRUM-389 existe SI Y SÓLO SI hay veredicto REIMPLEMENTACION', () => {
  const conPuntero = remisionesEn389();
  const conVeredicto = new Set(
    Object.entries(CENSO_ARITMETICA).filter(([, e]) => e.veredicto === 'REIMPLEMENTACION').map(([f]) => f),
  );

  // 🔴 EL SUELO VIGILA AL LECTOR, NO A LA POBLACIÓN — y esto nació de un rojo mal puesto.
  // La primera versión exigía «al menos una entrada REIMPLEMENTACION». Al provocar el control (b)
  // —quitar esa entrada dejando la remisión— el test caía, sí, pero POR EL SUELO y no por la rama
  // del puntero huérfano: el mensaje no decía lo que había pasado. Y peor: ese suelo habría puesto
  // en ROJO la limpieza legítima del día que se ejecute la opción B y no quede ninguna
  // reimplementación, que es un final CORRECTO. Un suelo no puede prohibir el buen estado final.
  //
  // Lo que sí hay que descartar es que el lector esté ciego: si no supiera extraer comentarios,
  // «no hay puntero» y «no supe leerlo» serían el mismo resultado.
  assert.ok(charsDeComentario() >= 300,
    `🔴 LECTOR CIEGO: sólo extraigo ${charsDeComentario()} caracteres de comentario del censo de `
    + 'SCRUM-389 (medido el 25-ago-2026: 1.560). Si no sé extraer comentarios, «no hay remisión» y '
    + '«no supe leerla» son el mismo número, y el ⟺ de abajo pasaría en vacío.');

  const faltaPuntero = [...conVeredicto].filter((f) => !conPuntero.has(f));
  assert.deepEqual(faltaPuntero, [],
    `🔴 FALTA EL PUNTERO en el censo de SCRUM-389 para: ${faltaPuntero.join(', ')}.\n`
    + `  Ese fichero está declarado aquí como REIMPLEMENTACION, pero su entrada de allí no remite a\n`
    + `  «${YO}». Sin esa remisión, quien lea aquel censo ve el fichero clasificado y deja de buscar:\n`
    + '  el veredicto de allí cubre la LLAMADA y no las líneas de al lado. Vuelve a poner el aviso\n'
    + '  PEGADO a su entrada (no suelto en el fichero: una nota al final no lleva a nadie).');

  const punteroHuerfano = [...conPuntero].filter((f) => !conVeredicto.has(f));
  assert.deepEqual(punteroHuerfano, [],
    `🔴 PUNTERO QUE APUNTA A NADA: ${punteroHuerfano.join(', ')}.\n`
    + '  La entrada de SCRUM-389 remite a este censo, pero aquí ya no hay veredicto REIMPLEMENTACION\n'
    + '  para ese fichero. O se borró la entrada y hay que borrar la remisión EN EL MISMO COMMIT, o\n'
    + '  el veredicto cambió y la remisión se quedó mintiendo.');
});

test('SCRUM-627b · 🔴 ② el veredicto REIMPLEMENTACION sólo vale mientras el detector lo marque', () => {
  const hallazgos = censarAritmeticaIva(RAIZ).hallazgos;
  const marcados = new Set(hallazgos.filter((h) => h.desgloseCompleto).map((h) => h.ruta));

  // SUELO: si el detector no marcara NADA, todo lo de abajo caería por ceguera y no por defecto.
  assert.ok(marcados.size >= 1,
    '🔴 el detector no marca NINGÚN desglose completo, ni siquiera la primitiva: está ciego, y un '
    + 'rojo suyo no significaría lo que este test dice que significa.');

  const declarados = Object.entries(CENSO_ARITMETICA)
    .filter(([, e]) => e.veredicto === 'REIMPLEMENTACION').map(([f]) => f);
  const yaNoReimplementan = declarados.filter((f) => !marcados.has(f));

  assert.deepEqual(yaNoReimplementan, [],
    `🔴 EL VEREDICTO YA NO CORRESPONDE: ${yaNoReimplementan.join(', ')} está declarado como\n`
    + '  REIMPLEMENTACION y el detector YA NO lo marca como desglose completo.\n\n'
    + '  Si es porque se ejecutó la opción B —el bloque pasó por la primitiva—: enhorabuena, y hay\n'
    + '  que quitar su entrada de esta tabla Y su remisión de SCRUM-389 en el MISMO commit. Dejarlas\n'
    + '  es peor que no haberlas puesto: el veredicto y la remisión mentirían los dos a la vez y en\n'
    + '  el mismo sentido, y su acuerdo se leería como confirmación.\n\n'
    + '  Si NO se ha tocado ese bloque, entonces es el detector el que ha dejado de verlo — y eso es\n'
    + '  un agujero mucho más grande que esta entrada.');
});

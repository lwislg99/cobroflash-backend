// tests/scrum778-la-lista-cableada.test.mjs — SCRUM-778
//
// Sin gate: AST sobre `src/`. Ni BD, ni red, ni navegador.
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// UNA LISTA CABLEADA DE FICHEROS ES UN CENSO CONGELADO EL DÍA QUE SE ESCRIBIÓ
//
// `LLAMADORES_DE_EMIT` tenía DOS ficheros y estaba copiada en TRES sitios: `scrum205`,
// `scrum206b` y `scrum246`. Medido el 6-sep-2026, el árbol tiene **TRES ficheros y CUATRO
// llamadas** a `emitInvoice`: `invoicesAdmin.routes.ts` (la boca de la factura suelta) entró
// después y ninguna de las tres listas creció.
//
// 🔴 Y EL DEFECTO DE FORMA ERA PEOR QUE EL DE CONTENIDO: las tres comprobaban **por fichero**
// —«¿aparece el portón en algún sitio de este fichero?»—. Un fichero con dos bocas pasa teniendo
// UNA protegida, y `albaranes.routes.ts` tiene dos.
//
// ── EL ROJO QUE NO SALÍA, PROVOCADO ANTES DE TOCAR NADA ─────────────────────────────────────
// Se añadió una TERCERA llamada a `emitInvoice` SIN portón en `albaranes.routes.ts` —un fichero
// que YA estaba en la lista—. El AST veía las tres (líneas 1164, 1378 y la inyectada). Los tres
// guards, ninguna:
//
//     scrum246  → exit 0 · 6/6 verde        scrum205 → exit 0 · 6/6        scrum206b → exit 0 · 3/3
//
// Restaurado y verificado por sha256 y por `git diff --exit-code`.
//
// ── ¿PONÍA ESTO EN RIESGO ALGO HOY? ─────────────────────────────────────────────────────────
// Medido antes de cambiar nada: NO. Las cuatro llamadas reales a `emitInvoice` pasan la
// comprobación POR LLAMADA con los dos portones (`exigirLineasFacturables` antes,
// `sellarTrasEmision` después). El árbol está protegido de hecho —SCRUM-771 gateó las bocas— y
// lo que faltaba era que alguien lo AFIRMARA. Así que este arreglo no pone rojo nada verde: pone
// mecanismo donde había una coincidencia.
//
// ── LO QUE SE ENTREGA ───────────────────────────────────────────────────────────────────────
// `tests/_bocas-de-emision.mjs`: la población DERIVADA, en un solo sitio, por LLAMADA. Es la
// `bocas()` que ya escribió SCRUM-771 —le funcionaba— extraída y parametrizada por portón. Los
// cuatro guards la comparten; el día que alguien la mejore, la mejora les llega a todos.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';   // SCRUM-730
import { analizarArbol } from './_embudo-factura.mjs';
import {
  bocasDeEmision, motivosParaNoFiarse, desprotegidas, fuentesTs, EMBUDO, EMISOR, DELEGA,
} from './_bocas-de-emision.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * 🔴 EL TRINQUETE DE LA POBLACIÓN. Los números MEDIDOS el 6-sep-2026 sobre `src/`.
 *
 * No pueden BAJAR sin que alguien lo anote: un censo que encoge deja de vigilar en silencio, y
 * su cero se lee igual que «nadie emite sin portón», que es la peor lectura posible. Pueden
 * SUBIR solos — un camino nuevo entra en el censo sin que nadie se acuerde de añadirlo, que es
 * justamente lo que la lista cableada no hacía.
 */
const MINIMO_EMBUDO = 7;
const MINIMO_EMISOR = 4;

/**
 * Los ficheros que decía la lista CABLEADA. Están aquí para una sola cosa: comprobar que la
 * población derivada NO PIERDE lo que la lista vieja ya veía. Es el trinquete que hace que el
 * cambio sea estrictamente más fuerte y no una permuta.
 */
const LO_QUE_VEIA_LA_LISTA_VIEJA = [
  'src/modules/jobs/app/routes/albaranes.routes.ts',
  'src/modules/jobs/domain/recapitulativa.service.ts',
];

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ① EL SUELO — un cero aquí se leería como «nadie emite sin portón»
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-778 · SUELO: la población derivada ni está vacía ni ha encogido, y cuadra con SCRUM-203', () => {
  const bocas = bocasDeEmision({ raiz: RAIZ });
  const creaciones = analizarArbol(path.join(RAIZ, 'src'));
  const motivos = motivosParaNoFiarse({
    bocas, creaciones, minimoEmbudo: MINIMO_EMBUDO, minimoEmisor: MINIMO_EMISOR,
  });
  assert.deepEqual(motivos, [],
    '🔴 CENSO CIEGO. La población derivada no es de fiar:\n    · ' + motivos.join('\n    · '));

  // Y el cruce, explícito: es SCRUM-203 quien garantiza que esta población es la COMPLETA.
  assert.ok(creaciones.length > 0,
    '🔴 el analizador oficial de SCRUM-203 no ve ninguna creación de factura.');
  assert.equal(bocas.filter((b) => b.tipo === 'embudo').length, creaciones.length,
    '🔴 las llamadas al embudo y las creaciones de factura no cuadran.');
});

test('SCRUM-778 · SUELO: el censo NO PIERDE lo que la lista cableada ya veía', () => {
  const ficheros = new Set(bocasDeEmision({ raiz: RAIZ })
    .filter((b) => b.tipo === 'emisor').map((b) => b.fichero));
  const perdidos = LO_QUE_VEIA_LA_LISTA_VIEJA.filter((f) => !ficheros.has(f));
  assert.deepEqual(perdidos, [],
    '🔴 la población DERIVADA ha perdido ficheros que la lista CABLEADA sí veía:\n    · '
    + perdidos.join('\n    · ')
    + '\n\n  Derivar tiene que ser estrictamente más fuerte que cablear. Si el derivador deja de '
    + 'ver algo que la lista vieja veía, el cambio no es una mejora: es una permuta con pérdida.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ② ✅ CONTROL POSITIVO — las ONCE bocas, incluidas las SEIS que no pasan por `emitInvoice`
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-778 · ✅ CONTROL POSITIVO: el censo ve las bocas del embudo, no sólo las de `emitInvoice`', () => {
  const bocas = bocasDeEmision({ raiz: RAIZ });

  // 🔴 ÉSTE ES EL ERROR DE PREMISA QUE HAY QUE IMPEDIR: un censo que sólo mirase a los llamadores
  // de `emitInvoice` vería CUATRO bocas y creería tener el árbol. Las otras siete piden número
  // ellas mismas y crean la factura con `tx.invoice.create` sin pasar por el emisor.
  const embudo = bocas.filter((b) => b.tipo === 'embudo');
  const emisor = bocas.filter((b) => b.tipo === 'emisor');
  assert.ok(emisor.length >= MINIMO_EMISOR,
    `🔴 sólo ${emisor.length} llamadas a \`${EMISOR}\`.`);

  // Las que NO pasan por el emisor: las del embudo menos la del propio delegador.
  const directas = embudo.filter((b) => b.fichero !== DELEGA);
  assert.ok(directas.length >= MINIMO_EMBUDO - 1,
    `🔴 CENSO CIEGO: sólo ${directas.length} bocas piden número por su cuenta, y se midieron `
    + `${MINIMO_EMBUDO - 1}. Si el censo sólo encuentra las de \`${EMISOR}\`, está ciego para la `
    + 'mayoría del árbol — y devuelva la lista que devuelva, su verde no significa nada.');

  // Y no viven todas en el mismo sitio: si salieran de un solo fichero, el barrido no estaría
  // recorriendo `src/` sino tropezándose con un fichero.
  const ficheros = new Set(directas.map((b) => b.fichero));
  assert.ok(ficheros.size >= 4,
    `🔴 las ${directas.length} bocas directas salen de sólo ${ficheros.size} fichero(s).`);

  // El delegador está, y está EXENTO por delegación — no por olvido.
  assert.ok(embudo.some((b) => b.fichero === DELEGA),
    `🔴 no se ve la llamada al embudo dentro de \`${EMISOR}\`: la exención por delegación estaría `
    + 'exenta de nada.');
});

test('SCRUM-778 · ✅ CONTROL POSITIVO: el censo ve la boca que la lista CABLEADA no veía', () => {
  // `invoicesAdmin.routes.ts` llama a `emitInvoice` (C7-suelta) y entró DESPUÉS de que se
  // escribieran las tres listas. Es el caso que da nombre al ticket.
  const bocas = bocasDeEmision({ raiz: RAIZ });
  const suelta = bocas.find((b) => b.tipo === 'emisor'
    && b.fichero === 'src/modules/system/app/routes/invoicesAdmin.routes.ts');
  assert.ok(suelta,
    '🔴 el censo NO ve la boca de la factura suelta, que es exactamente la que la lista cableada '
    + `se dejó fuera. Bocas de \`${EMISOR}\` vistas: `
    + bocas.filter((b) => b.tipo === 'emisor').map((b) => `${b.fichero}:${b.linea}`).join(', '));
  assert.equal(suelta.etiqueta, 'C7-suelta',
    `🔴 la etiqueta de esa boca se lee «${suelta.etiqueta}» y se midió «C7-suelta».`);

  // Y el fichero con DOS bocas de `emitInvoice`, que es el que hace inútil un control por fichero.
  const enAlbaranes = bocas.filter((b) => b.tipo === 'emisor'
    && b.fichero === 'src/modules/jobs/app/routes/albaranes.routes.ts');
  assert.ok(enAlbaranes.length >= 2,
    `🔴 sólo ${enAlbaranes.length} boca(s) en albaranes.routes.ts. El caso que justifica contar `
    + 'POR LLAMADA es precisamente que ese fichero tiene más de una.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ③ 🔴 EL QUE DECIDE — por LLAMADA y no por FICHERO
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** Un `src/` sintético: dos bocas protegidas y una tercera SIN portón, en el MISMO fichero. */
function arbolConTerceraBocaSinPorton() {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum778-'));
  const dir = path.join(raiz, 'src', 'modules', 'x');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'rutas.ts'), [
    'export async function una(tx: any, lineas: any) {',
    '  exigirLineasFacturables(lineas);',
    "  return emitInvoice(tx, { origen: 'C7-uno' } as any);",
    '}',
    'export async function otra(tx: any, lineas: any) {',
    '  exigirLineasFacturables(lineas);',
    "  return emitInvoice(tx, { origen: 'C7-dos' } as any);",
    '}',
    '// LA TERCERA, sin portón — en el MISMO fichero que las dos buenas.',
    'export async function tercera(tx: any) {',
    "  return emitInvoice(tx, { origen: 'C9-sin-porton' } as any);",
    '}',
  ].join('\n'));
  return raiz;
}

test('SCRUM-778 · 🔴 EL QUE DECIDE: una tercera boca SIN portón en un fichero ya listado SE NOMBRA', () => {
  const raiz = arbolConTerceraBocaSinPorton();
  const bocas = bocasDeEmision({ raiz, porton: 'exigirLineasFacturables', cuando: 'antes' });

  assert.equal(bocas.length, 3, `🔴 el banco no reproduce el caso: ${bocas.length} bocas y son 3.`);
  const fichero = 'src/modules/x/rutas.ts';
  assert.equal(new Set(bocas.map((b) => b.fichero)).size, 1,
    '🔴 las tres bocas tienen que estar en el MISMO fichero: ahí está el defecto.');

  // 🔴 LA COMPARACIÓN QUE ES EL TICKET ENTERO.
  //
  // POR FICHERO —lo que hacían las tres listas—: «¿aparece el portón en algún sitio del fichero?».
  // Aquí aparece dos veces, así que un control por fichero PASA EN VERDE con una boca desnuda.
  const fuente = fs.readFileSync(path.join(raiz, fichero), 'utf8');
  assert.ok(fuente.includes('exigirLineasFacturables'),
    '🔴 el banco no reproduce el caso: el fichero tiene que MENCIONAR el portón.');

  // POR LLAMADA —lo que hace el censo derivado—: la tercera sale nombrada, con su línea.
  const fuera = desprotegidas(bocas);
  assert.equal(fuera.length, 1,
    `🔴 el censo por LLAMADA no ha nombrado exactamente una boca desprotegida: ${JSON.stringify(fuera)}`);
  assert.match(fuera[0], /C9-sin-porton/,
    `🔴 la nombra, pero no dice CUÁL: «${fuera[0]}». Un rojo que no dice dónde mirar obliga a `
    + 'reproducirlo.');
  assert.match(fuera[0], /rutas\.ts:1[01]/,
    `🔴 el rojo no lleva la línea de la boca: «${fuera[0]}».`);

  // ✅ Y EL CONTROL NEGATIVO: con la tercera protegida, el censo NO acusa a nadie. Un detector
  // que señalase también las buenas sería igual de inútil, sólo que en la otra dirección.
  const arreglado = fs.readFileSync(path.join(raiz, fichero), 'utf8')
    .replace("export async function tercera(tx: any) {", 'export async function tercera(tx: any, lineas: any) {\n  exigirLineasFacturables(lineas);');
  fs.writeFileSync(path.join(raiz, fichero), arreglado);
  const bocas2 = bocasDeEmision({ raiz, porton: 'exigirLineasFacturables', cuando: 'antes' });
  assert.equal(bocas2.length, 3, '🔴 el arreglo del banco ha cambiado el número de bocas.');
  assert.deepEqual(desprotegidas(bocas2), [],
    '🔴 el censo sigue acusando con las TRES protegidas: acusaría a guards sanos.');
});

test('SCRUM-778 · 🔴 la DIRECCIÓN del portón importa: llamarlo DESPUÉS no protege', () => {
  // Un portón que se ejecuta después de pedir número no protege nada: el número ya está gastado,
  // y las dos salidas son malas (modificar una factura numerada, o dejar un hueco en la serie).
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum778b-'));
  const dir = path.join(raiz, 'src');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'tarde.ts'), [
    'export async function tarde(tx: any, lineas: any) {',
    "  const n = await allocateInvoiceNumber(tx, 1, { camino: 'C9' } as any);",
    '  exigirLineasFacturables(lineas);',
    '  return n;',
    '}',
  ].join('\n'));

  const antes = bocasDeEmision({ raiz, porton: 'exigirLineasFacturables', cuando: 'antes' });
  assert.equal(antes.length, 1, '🔴 el banco no tiene exactamente una boca.');
  assert.equal(antes[0].protegida, false,
    '🔴 un portón llamado DESPUÉS de pedir número se está contando como protección.');

  // Y el mismo código con la dirección contraria SÍ cuenta: es el caso de SCRUM-205/206b, donde
  // el sellado va después del commit a propósito. Sin esto, el helper impondría una sola
  // dirección y la mitad de sus usuarios tendría que mantener su copia.
  const despues = bocasDeEmision({ raiz, porton: 'exigirLineasFacturables', cuando: 'despues' });
  assert.equal(despues[0].protegida, true,
    '🔴 el helper no sabe mirar hacia adelante: SCRUM-205 y SCRUM-206b exigen su portón DESPUÉS.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ④ CONTRASTE — la excepción declarada de la RECTIFICATIVA sigue en pie
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-778 · CONTRASTE: la excepción de la RECTIFICATIVA (C5) sigue declarada y sigue existiendo', () => {
  // ⛔ NO SE TOCA. Está escrito en SCRUM-771 que el censo la exige o sobra, y aquí sólo se
  // comprueba que sigue habiendo un C5 al que la excepción se refiera: una excepción declarada
  // sobre un caso que ya no existe es una excepción que nadie retiró.
  const bocas = bocasDeEmision({ raiz: RAIZ });
  const c5 = bocas.filter((b) => b.etiqueta === 'C5');
  assert.ok(c5.length >= 1,
    '🔴 no hay ninguna boca etiquetada C5. La excepción declarada de la rectificativa en '
    + 'SCRUM-771 se referiría a un caso que ya no existe, y una excepción sin caso es una puerta '
    + 'abierta que nadie recuerda haber dejado.');

  const fuente771 = fs.readFileSync(path.join(RAIZ, 'tests/scrum771-el-emisor-no-valida-el-tipo.test.mjs'), 'utf8');
  assert.match(fuente771, /EXCEPCION_DECLARADA/,
    '🔴 SCRUM-771 ha dejado de declarar su excepción de la rectificativa.');
  assert.match(fuente771, /C5/,
    '🔴 la excepción declarada ya no nombra C5.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⑤ NADIE VUELVE A CABLEAR LA LISTA
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-778 · 🔴 ningún guard vuelve a cablear los llamadores de `emitInvoice`', () => {
  // La lista vivía COPIADA en tres ficheros. El trinquete no persigue la palabra —el comentario
  // que explica la prohibición la contiene, y ése es el defecto de `_guard-texto.mjs`— sino la
  // DECLARACIÓN: un `const … = [` con rutas de `src/` dentro.
  const sospechosos = [];
  for (const f of fs.readdirSync(path.join(RAIZ, 'tests')).filter((x) => x.endsWith('.test.mjs'))) {
    const txt = fs.readFileSync(path.join(RAIZ, 'tests', f), 'utf8');
    const m = /const\s+LLAMADORES_DE_EMIT\s*=\s*\[/.exec(txt);
    if (m) sospechosos.push(f);
  }
  assert.deepEqual(sospechosos, [],
    '🔴 ha vuelto una lista CABLEADA de llamadores de `emitInvoice`:\n    · '
    + sospechosos.join('\n    · ')
    + `\n\n  La población se deriva con \`bocasDeEmision()\` de \`tests/_bocas-de-emision.mjs\`, y `
    + 'se comprueba POR LLAMADA. Una lista escrita a mano se queda congelada el día que se '
    + 'escribe: la anterior tenía 2 ficheros y el árbol tiene 3.');

  // Y los tres guards que la tenían USAN el derivador. Si uno se descolgara, volvería a envejecer
  // solo — que es exactamente como nacieron las tres copias.
  for (const f of ['scrum205-un-solo-punto-de-sellado.test.mjs',
    'scrum206b-quien-emite-sella.test.mjs', 'scrum246-sin-lineas-no-se-emite.test.mjs']) {
    const txt = fs.readFileSync(path.join(RAIZ, 'tests', f), 'utf8');
    assert.match(txt, /from '\.\/_bocas-de-emision\.mjs'/,
      `🔴 ${f} ya no deriva la población: se le ha vuelto a cablear.`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LAS MUTACIONES QUE ME TUMBAN — las ejecuta `npm run meta:mutaciones`
// ═════════════════════════════════════════════════════════════════════════════════════════════
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // ① EL DEFECTO DEL TICKET, CONTRA EL DERIVADOR: el censo vuelve a contar **por fichero**.
    // Se colapsa la población a una boca por (fichero, tipo), que es exactamente lo que hacían las
    // tres listas cableadas. Con eso `albaranes.routes.ts` pasa de dos bocas a una y el control
    // positivo de abajo cae: sin ese fichero con DOS, contar por llamada no se distingue de contar
    // por fichero, y el ticket entero se queda sin caso.
    //
    // 🔴 ESTA DECLARACIÓN ESTABA MAL EN LOS DOS CAMPOS, y se corrige tras MEDIRLO, no tras leerlo.
    //
    // Decía mutar `albaranes.routes.ts` con un ancla —`const doc = await prisma.$transaction(...)`—
    // que **no existía en ese fichero ni el día que la escribí**: medido, `grep -c` da 0 tanto en mi
    // propio commit como en `origin/main`, y `main` NO ha tocado ese fichero desde entonces. No fue
    // el árbol moviéndose: nació caduca, porque empujé el ticket sin correr `meta:mutaciones`.
    //
    // Y el emparejamiento tampoco valía. Provocado el defecto A MANO en el fichero real —una
    // tercera llamada a `emitInvoice` sin portón, tres en total— y corrido este guard:
    // **8/8 EN VERDE, exit 0**. O sea que aun con el ancla perfecta habría salido MUDA. Este
    // fichero vigila el DERIVADOR, no la protección del árbol: eso lo comprueban `scrum246`,
    // `scrum205` y `scrum206b`, que consumen la población derivada. Re-anclar sin mirar esto
    // habría cambiado un rojo por otro.
    // ⚠️ Y `a` VA EN UN SOLO LITERAL, no en una concatenación con `+`. Medido: el lector oficial
    // (`mutacionesDeclaradas`, por AST) sólo acepta `ts.isStringLiteralLike`, así que una
    // expresión `'…' + '…'` NO ES UNA CADENA para él y la declaración entera desaparece **en
    // silencio** — el censo pasó de tres mutaciones a dos sin decir nada. Es el hueco que ya tenía
    // nombre (SCRUM-757) y aquí volvió a morder.
    fichero: 'tests/_bocas-de-emision.mjs',
    de: '    ts.forEachChild(sf, (n) => visitar(n, []));',
    a: '    ts.forEachChild(sf, (n) => visitar(n, []));\n    for (let i = out.length - 1; i > 0; i--) {\n      if (out.slice(0, i).some((b) => b.fichero === out[i].fichero && b.tipo === out[i].tipo)) out.splice(i, 1);\n    }',
    cae: 'SCRUM-778 · ✅ CONTROL POSITIVO: el censo ve la boca que la lista CABLEADA no veía',
  },
  {
    // ② El censo mirando sólo a `emitInvoice`: se queda ciego para las siete bocas del embudo,
    // que son la mayoría del árbol. Es el error de premisa que este ticket viene a impedir.
    fichero: 'tests/_bocas-de-emision.mjs',
    de: "        const tipo = nom === EMBUDO ? 'embudo' : nom === EMISOR ? 'emisor' : null;",
    a: "        const tipo = nom === EMISOR ? 'emisor' : null;",
    cae: 'SCRUM-778 · ✅ CONTROL POSITIVO: el censo ve las bocas del embudo, no sólo las de `emitInvoice`',
  },
  {
    // ③ La vuelta al control POR FICHERO: basta con que el portón aparezca en algún sitio.
    fichero: 'tests/_bocas-de-emision.mjs',
    de: "                if (cuando === 'antes' ? q < pos : q > pos) protegida = true;",
    a: '                if (q !== null) protegida = true;',
    cae: 'SCRUM-778 · 🔴 la DIRECCIÓN del portón importa: llamarlo DESPUÉS no protege',
  },
];

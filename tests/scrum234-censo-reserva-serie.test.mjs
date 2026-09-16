// SCRUM-234 · CENSO DE LAS FORMAS DE RESERVAR SERIE (sin gate: AST sobre `src/`, ni BD ni red).
//
// HAY DOS FORMAS CORRECTAS, Y ESA ES LA RAZÓN DE QUE ESTO SEA UN CENSO Y NO UNA PROHIBICIÓN:
//
//   · `{ increment: 1 }` — atómico en la propia BD. Vale para contadores SIMPLES.
//   · `pg_advisory_xact_lock` + read-then-write — vale para los que tienen REINICIO ANUAL,
//     donde `increment` no puede expresar «y si cambió el año, vuelve a 1» en un solo update.
//
// Un guard que exigiera `{ increment: … }` para todos marcaría en ROJO código bueno: obligaría a
// mover el reinicio anual de sitio, que es semántica fiscal y no una optimización. Así que lo que
// se ata no es la forma única —no existe— sino que **cada serie declare la suya y la cumpla**, y
// que un documento NUEVO no pueda nacer con la forma frágil sin que nadie lo decida.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA FORMA FRÁGIL, PARA QUE QUEDE ESCRITO QUÉ SE ESTÁ EVITANDO
//
// `findUnique(next*Number)` → `update({ next*Number: seq + 1 })` con valor ABSOLUTO y sin
// cerrojo. No serializa ni dentro de una transacción: ningún `$transaction` del proyecto fija
// `isolationLevel` (default READ COMMITTED) y el `findUnique` no bloquea la fila. Dos emisiones
// concurrentes leían el MISMO número, y lo que impedía el duplicado era el índice único —
// reventando la segunda emisión, que era válida.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(RAIZ, 'src');

/**
 * EL CENSO. Cada serie, su forma y el motivo de esa forma.
 *
 * `forma` es lo que el guard COMPRUEBA en el árbol, no una etiqueta: 'increment' exige el
 * `{ increment: … }` en el propio `data`; 'cerrojo' exige un `pg_advisory_xact_lock` en la
 * función que hace el update.
 */
const CENSO = {
  // SCRUM-313 (D2) · ESTE NO AVANZA UN CONTADOR: LO FIJA. Es «¿por qué número vas?» del alta, que
  // escribe el arranque de la serie una sola vez, antes de la primera factura.
  //
  // Entra en el censo igualmente porque hace lo que este test vigila —leer y escribir un valor
  // ABSOLUTO en `nextInvoiceNumber`—, y de hecho **lo cazó antes de que llegara a `main`**: la
  // primera versión no llevaba cerrojo. Sin él, entre leer «no hay facturas» y escribir el 42 cabe
  // una emisión, y esa factura consumiría la 001 — que DUPLICA un número que el profesional ya usó
  // en su programa anterior. Ni hueco ni carrera abstracta: el daño exacto que D2 viene a evitar.
  //
  // Forma `cerrojo`, mismo namespace que `allocateInvoiceNumber`, para que reservar un número y
  // declarar el arranque no puedan ocurrir a la vez. La relectura va DENTRO de la transacción:
  // comprobar fuera y escribir dentro no serializa nada.
  'src/app.ts': {
    campo: 'nextInvoiceNumber',
    forma: 'cerrojo',
    motivo:
      'SCRUM-313: FIJA el arranque de la serie en el alta (no lo avanza). Lee lo emitido y escribe '
      + 'un valor absoluto, así que necesita el mismo cerrojo que la reserva — y con la relectura '
      + 'dentro de la transacción, no fuera.',
  },
  'src/modules/quotes/domain/quoteNumber.service.ts': {
    campo: 'nextQuoteNumber',
    // 🔴 SCRUM-592 (DOC-02) · CAMBIA DE `increment` A `cerrojo`, Y ESTE CENSO LO EXIGIÓ.
    //
    // Hasta el 4-sep-2026 era un contador SIMPLE y la declaración decía, con razón, que
    // `{ increment: 1 }` bastaba: es atómico en la BD y serializa aunque no haya transacción.
    //
    // DOC-02 le da REINICIO ANUAL (`quoteSeriesYear`), y eso rompe el argumento entero: ya no se
    // suma uno, hay que LEER el año y DECIDIR si el siguiente es el contador o el 1. Eso es un
    // read-then-write con valor absoluto, que en READ COMMITTED **no serializa** — dos creaciones
    // del primer presupuesto del año leerían las dos «serie vacía» y escribirían las dos el 1.
    //
    // Es exactamente el razonamiento que este mismo fichero ya tenía escrito para la factura y el
    // albarán. La serie del presupuesto se une a ellos.
    forma: 'cerrojo',
    motivo:
      'REINICIO ANUAL (`quoteSeriesYear`, SCRUM-592). `increment` no puede expresar «y si cambió '
      + 'el año, vuelve a 1» en un solo update: hay que leer el año y decidir, y ese '
      + 'read-then-write con valor absoluto no serializa en READ COMMITTED. Mismo cerrojo y mismo '
      + 'namespace que la factura y el albarán. Y aquí importa más que en los otros dos: `Quote` '
      + 'NO tiene índice único sobre su número, así que el cerrojo es la ÚNICA garantía.',
  },
  'src/modules/invoicing/domain/invoiceNumber.service.ts': {
    campo: 'nextInvoiceNumber',
    forma: 'cerrojo',
    motivo:
      'REINICIO ANUAL (`invoiceSeriesYear`) y DOS contadores (F1 y R1). `increment` no puede '
      + 'expresar el reinicio en un solo update, así que llevarlo a esa forma obligaría a mover el '
      + 'reinicio de sitio — semántica fiscal, no optimización. El cerrojo serializa sin tocarla.',
  },
  'src/modules/jobs/domain/albaranNumber.service.ts': {
    campo: 'nextAlbaranNumber',
    forma: 'cerrojo',
    motivo:
      'Mismo caso: reinicio anual (`albaranSeriesYear`). No es documento fiscal, pero su serie se '
      + 'le muestra al cliente y se cita en la recapitulativa: dos albaranes con el mismo número '
      + 'son dos referencias que no distinguen a qué parte de la obra corresponde cada cosa.',
  },
};

const rel = (p) => path.relative(RAIZ, p).split(path.sep).join('/');
const fuentes = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) fuentes(p, out);
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
};

const esFuncion = (n) =>
  ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n);

/**
 * Sitios que AVANZAN un contador de serie: un `update` cuyo `data` toca un campo `next…Number`.
 * Se reconoce por la forma del árbol, no por el nombre del fichero: un servicio nuevo aparece
 * aquí solo, sin que nadie tenga que acordarse de añadirlo.
 */
/*
 * `raiz` es PARÁMETRO (y no `SRC` fijo) por lo que costó descubrirlo: las dos autopruebas de
 * abajo escribían su servicio de mentira DENTRO de `src/modules/` y lo borraban al acabar.
 * `node --test` corre los ficheros de test EN PARALELO, así que SCRUM-243 y SCRUM-245 —que
 * recorren ese mismo árbol— se encontraban el fichero a medio existir y morían con ENOENT por
 * un motivo que no tiene nada que ver con su tema (la señal de R8). Medido: 2 rojos ajenos en
 * la suite completa, ninguno reproducible al correr este fichero solo. Un fixture que escribe
 * en un árbol compartido no es un fixture aislado.
 */
function avancesDeSerie(raiz = SRC) {
  const out = [];
  for (const p of fuentes(raiz)) {
    const codigo = fs.readFileSync(p, 'utf8');
    const arbol = ts.createSourceFile(p, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const r = rel(p);
    const visitar = (n, pila) => {
      const nueva = esFuncion(n) ? [...pila, n] : pila;
      if (ts.isPropertyAssignment(n) && /^next\w*Number$/.test(n.name.getText(arbol))) {
        // Solo cuenta si es el `data:` de un update — no un `select:` ni un tipo.
        const dentroDeData = (() => {
          let q = n.parent;
          while (q) {
            if (ts.isPropertyAssignment(q) && q.name.getText(arbol) === 'data') return true;
            if (ts.isPropertyAssignment(q) && q.name.getText(arbol) === 'select') return false;
            q = q.parent;
          }
          return false;
        })();
        if (dentroDeData) {
          const init = n.initializer.getText(arbol);
          const fn = nueva[nueva.length - 1];
          out.push({
            fichero: r,
            campo: n.name.getText(arbol),
            linea: arbol.getLineAndCharacterOfPosition(n.getStart(arbol)).line + 1,
            usaIncrement: /\bincrement\b/.test(init),
            // El cerrojo se busca en la función que hace el update: es donde tiene que estar
            // para cubrir la lectura Y la escritura.
            tieneCerrojo: !!fn && /pg_advisory_xact_lock/.test(fn.getText(arbol)),
          });
        }
      }
      ts.forEachChild(n, (h) => visitar(h, nueva));
    };
    ts.forEachChild(arbol, (n) => visitar(n, []));
  }
  return out;
}

test('SCRUM-234 · toda serie está en el censo, y no hay una cuarta sin decidir', () => {
  const avances = avancesDeSerie();

  assert.ok(
    avances.length >= 3,
    `🔴 ESCÁNER CIEGO: veo ${avances.length} avances de serie y las series conocidas son 3. Si los ` +
      'contadores se renombraron (dejaron de llamarse `next…Number`), este censo dejó de censar nada.',
  );

  const fuera = [...new Set(avances.map((a) => a.fichero))].filter((f) => !(f in CENSO));
  assert.deepEqual(
    fuera, [],
    '🔴 HAY UNA SERIE FUERA DEL CENSO:\n' + fuera.map((f) => `    ${f}`).join('\n') +
      '\n\n  No es un fallo: es una DECISIÓN pendiente. Esa serie reserva números y hay que elegir\n' +
      '  su forma, con su motivo:\n' +
      '    · `{ increment: 1 }`   si el contador es SIMPLE (no se reinicia).\n' +
      '    · `pg_advisory_xact_lock` si tiene REINICIO ANUAL, donde `increment` no puede\n' +
      '      expresarlo en un solo update sin mover el reinicio de sitio.\n\n' +
      '  Lo que no vale es la tercera: leer el contador y escribir el valor absoluto sin cerrojo.\n' +
      '  Eso no serializa en READ COMMITTED, y el índice único te salva reventando la emisión.\n' +
      '  Añádela arriba con su forma y su motivo.',
  );
});

test('SCRUM-234 · cada serie CUMPLE la forma que declara', () => {
  const avances = avancesDeSerie();
  const incumplen = [];

  for (const [fichero, decl] of Object.entries(CENSO)) {
    const suyos = avances.filter((a) => a.fichero === fichero);
    assert.ok(
      suyos.length > 0,
      `🔴 ESCÁNER CIEGO: ${fichero} está en el censo y NO se le ve avanzar ningún contador. ` +
        '¿Se movió la reserva a otro fichero? Actualiza el censo antes de fiarte del verde.',
    );
    for (const a of suyos) {
      if (decl.forma === 'increment' && !a.usaIncrement) {
        incumplen.push(`${a.fichero}:${a.linea} declara 'increment' y escribe un valor absoluto`);
      }
      if (decl.forma === 'cerrojo' && !a.tieneCerrojo) {
        incumplen.push(`${a.fichero}:${a.linea} declara 'cerrojo' y NO hay pg_advisory_xact_lock en su función`);
      }
    }
  }

  assert.deepEqual(
    incumplen, [],
    '🔴 UNA SERIE NO CUMPLE SU FORMA DECLARADA:\n' + incumplen.map((s) => `    ${s}`).join('\n') +
      '\n\n  El censo no es documentación: es lo que este test comprueba. Si la forma cambió, la\n' +
      '  declaración tiene que cambiar con ella — y si desapareció el cerrojo, la carrera de\n' +
      '  numeración está de vuelta y el índice único vuelve a ser lo único que hay.',
  );
});

test('SCRUM-234 (autoprueba) · una cuarta serie con la forma frágil sale ROJA', () => {
  // Un guard que nunca se ha visto en rojo es decoración. Se inventa el servicio que este censo
  // existe para cazar: el que reserva leyendo y escribiendo el valor absoluto, sin cerrojo.
  // FUERA de `src/`: ver la nota de `avancesDeSerie`. El escáner recibe la raíz, así que el
  // fixture no necesita vivir en el árbol de verdad para que lo descubra por forma.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-s234-__tmp_serie-'));
  const f = path.join(dir, 'reciboNumber.service.ts');
  fs.writeFileSync(f, [
    "import { Prisma } from '@prisma/client';",
    'export async function allocateReciboNumber(tx: Prisma.TransactionClient, merchantId: number) {',
    '  const m = await tx.merchant.findUnique({ where: { id: merchantId }, select: { nextReciboNumber: true } });',
    '  const seq = m!.nextReciboNumber;',
    '  await tx.merchant.update({ where: { id: merchantId }, data: { nextReciboNumber: seq + 1 } });',
    '  return `R-${seq}`;',
    '}',
  ].join('\n'));

  try {
    const avances = avancesDeSerie(dir);
    const nuevo = avances.find((a) => a.fichero.includes('__tmp_serie'));
    assert.ok(nuevo, '🔴 el escáner NO ve la cuarta serie: entonces no censa por forma, censa por lista');
    assert.equal(nuevo.campo, 'nextReciboNumber');
    assert.equal(nuevo.usaIncrement, false, '🔴 el escáner cree que un valor absoluto es un increment');
    assert.equal(nuevo.tieneCerrojo, false, '🔴 el escáner ve un cerrojo donde no hay ninguno');
    assert.ok(
      !(nuevo.fichero in CENSO),
      '🔴 la cuarta serie estaría en el censo sin haberla decidido nadie',
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('SCRUM-234 (autoprueba) · el escáner NO confunde un `select` con un avance', () => {
  // `nextInvoiceNumber` aparece también en los `select:` de las lecturas. Contarlos como avances
  // haría que el censo pidiera un cerrojo en cada sitio que se limita a LEER el contador.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-s234-__tmp_serie2-')); // fuera de `src/`, ídem
  const f = path.join(dir, 'solo-lee.service.ts');
  fs.writeFileSync(f, [
    "import { Prisma } from '@prisma/client';",
    'export async function leer(tx: Prisma.TransactionClient, merchantId: number) {',
    '  return tx.merchant.findUnique({ where: { id: merchantId }, select: { nextInvoiceNumber: true } });',
    '}',
  ].join('\n'));

  try {
    const avances = avancesDeSerie(dir);
    assert.equal(
      avances.filter((a) => a.fichero.includes('__tmp_serie2')).length, 0,
      '🔴 FALSO POSITIVO: un `select` del contador se cuenta como avance de serie.',
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

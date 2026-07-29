// SCRUM-207 · los 7 caminos crean la factura en la MISMA transacción que reservó su número.
//
// DE QUÉ DEPENDE ESTO, para que nadie lo relaje sin saber qué rompe:
//
//  1) **Q1b, la consulta de inspección.** `factura_emitida` lleva `entity_id NULL` (la factura
//     todavía no existe cuando se reserva su número; la identidad es `meta.numero`). Por eso
//     Q1b la localiza por `created_at` EXACTO contra el `createdAt` de la factura — y eso solo
//     funciona porque en PostgreSQL `now()` es `transaction_timestamp()`, constante dentro de
//     una transacción. Los dos `@default(now())` de la misma tx dan el MISMO sello.
//     Si un camino reservara el número en una tx y creara la factura en otra, los sellos serían
//     distintos y **Q1b devolvería vacío para ese camino**: sin error, sin aviso, y justo en la
//     consulta que se usa en una inspección. Degradación silenciosa en el peor sitio.
//
//  2) **La garantía «si no consta, no se emite».** Si el receptor no es una transacción de
//     verdad, el `factura_emitida` transaccional no protege NADA: un fallo del registro deja de
//     deshacer la emisión y vuelve el fallo mudo. Y el TIPO NO LO IMPIDE: `Prisma.TransactionClient`
//     es `Omit<PrismaClient, …>`, así que el cliente global es estructuralmente asignable y
//     `allocateInvoiceNumber(prisma, …)` **compila limpio** (comprobado con `tsc`). Lo que impide
//     esa fuga es este guard, no el compilador.
//
// AST, no grep (regla 38): lee el árbol sin tocar una línea del camino de emisión, y los
// comentarios no existen para el analizador — la trampa de autorreferencia que mordió cuatro
// veces (SCRUM-176/168/3/193) aquí no puede darse.
import test from 'node:test';
import assert from 'node:assert/strict';
import { analizarFuente, analizarArbol, analizarDelegacion } from './_misma-tx.mjs';

// Los 7 sitios del mapa de SCRUM-200 §2.1. El número es un RATCHET: si aparece un camino 8,
// este test cae y alguien tiene que declararlo a mano. Es la misma idea que el censo de
// SCRUM-203, y por el mismo motivo — una lista que nadie ata se desincroniza en silencio.
const CAMINOS_ESPERADOS = 7;

/** Funciones que NO abren la transacción: la reciben. Su garantía la ponen sus llamadores. */
const DELEGADAS = [{ fnNombre: 'emitInvoice', indiceParam: 0 }];

test('SCRUM-207 · los 7 caminos: el create usa el MISMO cliente que reservó el número', () => {
  const hallazgos = analizarArbol('src')
    .filter((h) => !h.ruta.endsWith('invoiceNumber.service.ts')); // la declaración, no una llamada

  assert.equal(
    hallazgos.length, CAMINOS_ESPERADOS,
    `el mapa dice ${CAMINOS_ESPERADOS} caminos y el árbol tiene ${hallazgos.length}. ` +
    'Si has añadido uno, declara aquí por qué y comprueba que crea en la misma tx.',
  );

  const fugas = hallazgos.filter((h) => !h.ok);
  assert.deepEqual(
    fugas.map((f) => `${f.ruta}:${f.linea} (receptor «${f.receptor}», origen ${f.origenDelReceptor})`),
    [],
    'algún camino reserva el número con un cliente y crea la factura con otro',
  );
});

test('SCRUM-207 · la cadena de la delegación: quien recibe la tx la recibe de un $transaction', () => {
  // `emitInvoice(tx, …)` no abre transacción, así que su ✅ es PRESTADO: vale lo que valgan sus
  // llamadores. Sin esta comprobación, C7 daría por buena una garantía que no ha mirado nadie.
  const llamadas = analizarDelegacion('src', DELEGADAS);
  assert.ok(llamadas.length > 0, 'si no se encuentra ninguna llamada, el analizador está ciego');
  assert.deepEqual(
    llamadas.filter((l) => !l.ok).map((l) => `${l.ruta}:${l.linea} → ${l.fnNombre}(${l.receptor})`),
    [],
    'una llamada a una función delegada le pasa algo que no viene de un $transaction',
  );
});

// ── AUTOPRUEBA · el analizador cazado con casos sintéticos ────────────────────────────
// Un guard que nunca se ha visto actuar es decoración. Estos casos no dependen del árbol
// real, así que siguen probando el analizador el día que el código cambie.

test('SCRUM-207 · autoprueba: el patrón BUENO no da falso positivo', () => {
  const [h] = analizarFuente(`
    async function emitir(prisma: any) {
      return prisma.$transaction(async (tx: any) => {
        const numero = await allocateInvoiceNumber(tx, 1, { camino: 'C3', actor: A });
        return tx.invoice.create({ data: { number: numero } });
      });
    }`);
  assert.equal(h.ok, true);
  assert.equal(h.origenDelReceptor, '$transaction');
});

test('SCRUM-207 · autoprueba: reservar en la tx y crear con el cliente GLOBAL → fuga', () => {
  // Este es el caso que rompe Q1b: dos `now()` distintos. Y compila sin una queja.
  const [h] = analizarFuente(`
    async function emitir(prisma: any) {
      const numero = await prisma.$transaction(async (tx: any) =>
        allocateInvoiceNumber(tx, 1, { camino: 'C3', actor: A }));
      return prisma.invoice.create({ data: { number: numero } });
    }`);
  assert.equal(h.mismaTx, false, 'el create está fuera de la función del $transaction');
  assert.equal(h.ok, false);
});

test('SCRUM-207 · autoprueba: un parámetro TIPADO como transacción sí delega (emitInvoice)', () => {
  const [h] = analizarFuente(`
    async function emitInvoice(tx: Prisma.TransactionClient, input: any) {
      const numero = await allocateInvoiceNumber(tx, 1, { camino: 'C7', actor: A });
      return tx.invoice.create({ data: { number: numero } });
    }`);
  assert.equal(h.origenDelReceptor, 'parametro');
  assert.equal(h.ok, true, 'delegar la transacción es legítimo — si el tipo lo declara');
});

test('SCRUM-207 · autoprueba: pasar el cliente GLOBAL al embudo → fuga', () => {
  // `allocateInvoiceNumber(prisma, …)` compila (TransactionClient = Omit<PrismaClient, …>).
  // Sin transacción no hay rollback: la garantía del ticket desaparece entera.
  const [h] = analizarFuente(`
    async function emitir(prisma: any) {
      const numero = await allocateInvoiceNumber(prisma, 1, { camino: 'C3', actor: A });
      return prisma.invoice.create({ data: { number: numero } });
    }`);
  assert.equal(h.origenDelReceptor, 'DESCONOCIDO', 'el receptor no viene de ningún $transaction');
  assert.equal(h.ok, false, 'fail-closed: si no se puede declarar que es una tx, es fuga');
});

test('SCRUM-207 · autoprueba: dos clientes distintos en la misma función → fuga', () => {
  // El caso PEQUEÑO, el que un guard de vecindad dejaría pasar: el `$transaction` está ahí,
  // pegado, y aun así la factura se crea con otro receptor.
  const [h] = analizarFuente(`
    async function emitir(prisma: any, otroTx: any) {
      return prisma.$transaction(async (tx: any) => {
        const numero = await allocateInvoiceNumber(tx, 1, { camino: 'C3', actor: A });
        return otroTx.invoice.create({ data: { number: numero } });
      });
    }`);
  assert.equal(h.mismaTx, false, '«tx» reservó y «otroTx» creó');
  assert.equal(h.ok, false);
});

test('SCRUM-207 · autoprueba: los comentarios NO cuentan (trampa de autorreferencia)', () => {
  const [h] = analizarFuente(`
    async function emitir(prisma: any) {
      return prisma.$transaction(async (tx: any) => {
        // OJO: nunca hagas prisma.invoice.create({}) aquí, ni allocateInvoiceNumber(prisma, …)
        const numero = await allocateInvoiceNumber(tx, 1, { camino: 'C3', actor: A });
        return tx.invoice.create({ data: { number: numero } });
      });
    }`);
  assert.equal(h.ok, true, 'el comentario que explica la prohibición no puede dispararla');
});

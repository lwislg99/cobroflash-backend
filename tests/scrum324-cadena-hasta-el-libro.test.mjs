// tests/scrum324-cadena-hasta-el-libro.test.mjs — SCRUM-324 (E3)
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL TEST QUE NADIE EXIGIÓ, Y POR ESO SE CERRÓ MAL SCRUM-426
//
// Las seis columnas fiscales de `Expense` llevaban desde el 10-ago **en las tres bases**. El libro
// de facturas recibidas las LEE y se sirve en `/admin/libros/recibidas.csv`. Y sin embargo salía
// **vacío por diseño**: `libroRecibidas.ts` excluye todo gasto sin `baseAmount`, y en todo `src/`
// **no había una sola escritura** de ese campo. Motor y lector construidos, cadena rota en medio.
//
// «Se pintan los campos» no es la prueba. La prueba es **que el asiento aparezca en el libro**:
//
//     alta con base/tipo/cuota → se guarda → el libro SALE CON ESE ASIENTO DENTRO
//
// Si el libro sigue vacío, no está hecho, por mucho campo que se pinte.
//
// ⚠️ NINGUNA BASE REAL: banco desechable (loopback + base terminada en `_test`), fail-closed, y
// todo lo que se lee lo ha creado este mismo test.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseBDSegura } from '../scripts/_db-guard.mjs';
import { withMerchant } from './_merchant-fixture.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const URL_BANCO = process.env.LIBRO_PG_URL || '';
const ENABLED = URL_BANCO !== '';
const SELLO = `e3${process.pid}`;

const { createExpense } = await import('../dist/modules/expenses/domain/expenses.service.js');
const { leerLibroRecibidas } = await import('../dist/modules/invoicing/domain/libroRecibidas.repo.js');
const { clasificarJustificante } = await import('../dist/modules/expenses/domain/justificante.js');

const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

/**
 * El fuente SIN COMENTARIOS.
 *
 * 🔴 Un guard que prohíbe un texto por búsqueda literal **se caza a sí mismo en el comentario
 * que explica la prohibición**: la primera versión de este fichero se puso roja por su propia
 * explicación de por qué el aviso fiscal no se enciende. Se mira lo que se PINTA, no lo que se
 * cuenta sobre lo que no se pinta.
 */
const sinComentarios = (rel) => leer(rel)
  .split(String.fromCharCode(10))
  .filter((l) => !l.trimStart().startsWith('//'))
  .join(String.fromCharCode(10))
  .replace(/\/\*[\s\S]*?\*\//g, '');

function exigirBancoDesechable(url) {
  const p = parseBDSegura(url);
  assert.ok(p, '🔴 LIBRO_PG_URL no es legible.');
  assert.ok(['127.0.0.1', 'localhost', '::1'].includes(p.host), `🔴 «${p.host}» no es loopback.`);
  assert.ok(p.base.endsWith('_test'), `🔴 «${p.base}» no termina en «_test».`);
  return `${p.host}:${p.puerto}/${p.base}`;
}

// ── SUELO: el censo de ESCRITURAS fiscales ───────────────────────────────────────────────────

/** Los cinco que este ticket enseña a escribir. `vatDeducible` lo decide el dominio, no la pantalla. */
const CAMPOS = ['baseAmount', 'vatRate', 'vatAmount', 'providerInvoiceNumber', 'providerInvoiceDate'];

test('SCRUM-324 · SUELO: el servicio ESCRIBE los cinco campos, y el censo sabe verlo', () => {
  const servicio = leer('src/modules/expenses/domain/expenses.service.ts');
  const escritos = CAMPOS.filter((c) => new RegExp(`${c}:\\s*data\\.${c}`).test(servicio));
  assert.deepEqual(escritos, CAMPOS,
    `🔴 el servicio solo escribe ${escritos.length} de ${CAMPOS.length} campos fiscales ` +
    `(faltan: ${CAMPOS.filter((c) => !escritos.includes(c)).join(', ')}).\n\n` +
    '  Éste es el estado del que sale el ticket: columnas en las tres bases, un lector que las lee\n' +
    '  y NADIE que las escriba. Un censo que devolviera cero aquí estaría midiendo el defecto\n' +
    '  original y llamándolo verde.');

  // Control positivo del instrumento: la misma regexp encuentra un campo que YA se escribía.
  assert.match(servicio, /receiptData:\s*data\.receiptData/,
    '🔴 el censo no encuentra `receiptData`, que se escribe desde siempre: el instrumento está ciego.');
});

test('SCRUM-324 · SUELO: la pantalla PINTA los tres del desglose y los ENVÍA', () => {
  const vista = leer('public/dashboard/js/expensesView.js');
  for (const id of ['exp-base', 'exp-vatrate', 'exp-vatamount']) {
    assert.ok(vista.includes(`id="${id}"`), `🔴 el formulario no pinta «${id}».`);
  }
  for (const c of ['baseAmount:', 'vatRate:', 'vatAmount:']) {
    assert.ok(vista.includes(c), `🔴 «${c}» no viaja en el payload: el campo se pinta y no se manda.`);
  }
  // El proveedor, por NOMBRE y no por id numérico (el defecto que abría este ticket).
  assert.match(vista, /<select id="exp-providerid">/,
    '🔴 el proveedor ha vuelto a ser un input numérico: nadie se sabe el 47 de pie en un almacén.');
  assert.match(vista, /apiRequest\('\/admin\/providers'\)/,
    '🔴 el selector no se puebla de la API: sería un desplegable vacío.');
});

test('SCRUM-324 · la microcopy de la foto es la APROBADA, y la fiscal NO está encendida', () => {
  const vista = leer('public/dashboard/js/expensesView.js');
  assert.ok(vista.includes('Guardamos la foto como tu copia. Los datos fiscales salen de los campos de arriba.'),
    '🔴 falta el texto aprobado bajo «Foto del ticket». Es microcopy oficial (regla 30): no se ' +
    'reescribe ni se parafrasea.');

  // 🔴 Y lo que NO puede estar: la afirmación fiscal espera al asesor. Se mira el fuente SIN
  // comentarios, o este guard se caza a sí mismo en la línea que explica la prohibición.
  assert.doesNotMatch(sinComentarios('public/dashboard/js/expensesView.js'), /no puedes deducir el IVA/i,
    '🔴 se ha encendido la afirmación fiscal sobre el ticket. Decir qué admite Hacienda es una ' +
    'afirmación FISCAL y espera al asesor: las tres versiones viven en ' +
    '`docs/legal/PREGUNTAS_ASESOR.md:539-542` como preguntas SIN responder.');
  assert.doesNotMatch(sinComentarios('public/dashboard/js/expensesView.js'), /id="exp-aviso-iva"/,
    '🔴 ha vuelto el contenedor vacío del aviso. Un `<div>` mudo esperando texto es un enlace ' +
    'construido que no se pinta nunca (SCRUM-424) un paso antes, y encima invita a rellenarlo sin ' +
    'aprobación. El día que haya frase, el div cuesta una línea.');
});

// ── EL CONTROL QUE DECIDE ────────────────────────────────────────────────────────────────────

test('SCRUM-324 · 🔴 LA CADENA ENTERA: se da de alta con desglose y el LIBRO trae el asiento',
  { skip: !ENABLED && 'sin LIBRO_PG_URL (banco desechable)' },
  async (t) => {
    t.diagnostic(`banco: ${exigirBancoDesechable(URL_BANCO)}`);
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({ datasourceUrl: URL_BANCO });

    try {
      await withMerchant(prisma, { name: `QA E3 ${SELLO}`, email: `e3.${SELLO}@qa.invalid` }, async (m) => {
        const prov = await prisma.provider.create({
          data: { merchantId: m.id, name: `Almacen Central ${SELLO}`, taxId: 'B12345678' },
        });

        // Alta EXACTAMENTE como la manda la pantalla: total con IVA + el desglose.
        const gasto = await createExpense(m.id, {
          concept: 'Tubo de cobre', amount: 121, currency: 'EUR', category: 'materiales',
          date: new Date(2026, 4, 12), providerId: prov.id,
          baseAmount: 100, vatRate: 21, vatAmount: 21,
          providerInvoiceNumber: `A-2026/${SELLO}`, providerInvoiceDate: new Date(2026, 4, 12),
        });

        // ① Se guardó de verdad, y no «se aceptó y se perdió».
        const enBase = await prisma.expense.findUnique({ where: { id: gasto.id } });
        assert.equal(Number(enBase.baseAmount), 100,
          '🔴 la base NO se ha guardado. La ruta la acepta y el servicio la tira: es exactamente el ' +
          'defecto que este ticket viene a cerrar, un campo más arriba.');
        assert.equal(Number(enBase.vatAmount), 21);
        assert.equal(enBase.providerInvoiceNumber, `A-2026/${SELLO}`);

        // ② 🔴 Y EL LIBRO LO TRAE. Ésta es la prueba; lo demás es preparación.
        const libro = await leerLibroRecibidas(prisma, m.id, new Date(2026, 3, 1), new Date(2026, 5, 30, 23, 59, 59, 999));
        assert.ok(libro.miradas >= 1,
          `🔴 el libro dice haber mirado ${libro.miradas} gastos: no está leyendo los del periodo, ` +
          'así que «cero asientos» no significaría nada.');

        const mio = libro.asientos.find((a) => a.numeroProveedor === `A-2026/${SELLO}`);
        assert.ok(mio,
          `🔴 EL LIBRO SIGUE VACÍO DE ESTE ASIENTO. Miradas: ${libro.miradas} · asientos: ` +
          `${libro.asientos.length} · sin clasificar: ${libro.sinClasificar}.\n\n` +
          '  Que la pantalla pinte los campos NO es la función. La función es que el gasto llegue al\n' +
          '  libro de facturas recibidas — y si no llega, el profesional cree que lleva su\n' +
          '  contabilidad de compras y no lleva ninguna.');
        assert.equal(Number(mio.base), 100, '🔴 el asiento llega al libro con otra base.');
        assert.equal(Number(mio.cuota), 21, '🔴 el asiento llega al libro con otra cuota.');
      });
    } finally { await prisma.$disconnect(); }
  });

test('SCRUM-324 · CONTROL NEGATIVO: un gasto SIN desglose se sigue guardando y se DECLARA',
  { skip: !ENABLED && 'sin LIBRO_PG_URL (banco desechable)' },
  async () => {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({ datasourceUrl: URL_BANCO });
    try {
      await withMerchant(prisma, { name: `QA E3b ${SELLO}`, email: `e3b.${SELLO}@qa.invalid` }, async (m) => {
        // El caso de siempre: una foto de un ticket y un importe. Tiene que seguir funcionando.
        const gasto = await createExpense(m.id, {
          concept: 'Ferretería', amount: 12.5, category: 'materiales', date: new Date(2026, 4, 20),
        });
        assert.ok(gasto.id, '🔴 un gasto sin datos fiscales ha dejado de poder darse de alta.');
        assert.equal(gasto.baseAmount, null, '🔴 se le ha inventado una base a un gasto que no la traía.');

        const libro = await leerLibroRecibidas(prisma, m.id, new Date(2026, 3, 1), new Date(2026, 5, 30, 23, 59, 59, 999));
        assert.equal(libro.asientos.length, 0, '🔴 un gasto sin base ha entrado como asiento.');
        assert.equal(libro.sinClasificar, 1,
          '🔴 el gasto sin desglose no se está DECLARANDO. Excluirlo en silencio deja un libro que ' +
          'se lee como «no compré nada» — se excluye Y SE DICE, con su recuento y su dinero.');
        assert.ok(Number(libro.sinClasificarImporte) > 0,
          '🔴 se declara el recuento pero no el importe: «un gasto fuera» y «12,50 € fuera» no son ' +
          'la misma información para quien decide si le compensa arreglarlo.');
      });
    } finally { await prisma.$disconnect(); }
  });

test('SCRUM-324 · 🔴 el motor del justificante ya no se alimenta de NULOS', () => {
  // La rama pasaba a `clasificarJustificante` los campos recién leídos de la fila creada — que
  // hoy eran SIEMPRE null. Un motor conectado y alimentado con nulos PARECE que funciona: devuelve
  // un veredicto, y es siempre el mismo.
  const conNulos = clasificarJustificante({
    amount: 121, date: new Date(2026, 4, 12), nifProveedor: 'B12345678',
    vatRate: null, vatAmount: null, providerInvoiceNumber: null, vatDeducible: null,
  });
  const conDatos = clasificarJustificante({
    amount: 121, date: new Date(2026, 4, 12), nifProveedor: 'B12345678',
    vatRate: 21, vatAmount: 21, providerInvoiceNumber: 'A-2026/114', vatDeducible: null,
  });
  assert.notEqual(conNulos.veredicto, conDatos.veredicto,
    `🔴 el veredicto es el mismo («${conNulos.veredicto}») con datos y sin ellos. Entonces el motor ` +
    'no está midiendo nada, y da igual haberlo conectado: «se arregla solo cuando escribas los ' +
    'campos» era una afirmación, y ésta es su medida.');
});

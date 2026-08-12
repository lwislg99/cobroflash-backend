// tests/scrum441-paidvia-sin-copia.test.mjs — SCRUM-441
//
// LA COLUMNA `invoices.paid_via` ENTRA VACÍA, Y ESTO ES LO QUE LO SOSTIENE.
//
// Sin mecanismo, «no hagas backfill» es una frase en un documento. Con él, el día que alguien
// escriba el `UPDATE … FROM charges` —con toda su buena intención, para «arreglar» los históricos—
// la suite se lo dice ANTES de que llegue a una base.
//
// 🔴 EL SUELO ES LA MITAD DEL GUARD. Hoy la columna todavía no existe, así que el barrido sobre
// `src/` da CERO por construcción: un cero que no distingue «no hay backfill» de «no sé mirar». Por
// eso el detector se prueba primero contra una fixture que SÍ lo tiene.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buscarBackfill, describir, ALLOWLIST } from './_censo-backfill-paidvia.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');

/** Todos los ficheros de una carpeta que acaben en alguna de las extensiones dadas. */
function recoger(dir, exts) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') out.push(...recoger(p, exts)); continue; }
    if (exts.some((x) => e.name.endsWith(x))) out.push(p);
  }
  return out;
}

function entradasDelArbol() {
  const ficheros = [
    ...recoger(path.join(RAIZ, 'src'), ['.ts']),
    ...recoger(path.join(RAIZ, 'docs', 'sql'), ['.sql']),
    ...recoger(path.join(RAIZ, 'scripts'), ['.mjs', '.js']),
  ];
  return ficheros.map((f) => ({
    ruta: path.relative(RAIZ, f).replace(/\\/g, '/'),
    texto: fs.readFileSync(f, 'utf8'),
  }));
}

// ── SUELO ────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-441 · SUELO: el detector VE un backfill de verdad, en sus cuatro formas', () => {
  const fixtures = [
    {
      ruta: 'fixture/backfill-sql.sql',
      texto: 'UPDATE invoices i SET paid_via = c.method FROM charges c WHERE c.id = i.charge_id;',
    },
    {
      ruta: 'fixture/backfill-ts.ts',
      texto: 'await prisma.invoice.update({ where: { id }, data: { paidVia: charge.method } });',
    },
    {
      ruta: 'fixture/backfill-raw.ts',
      texto: 'await prisma.$executeRawUnsafe(`UPDATE invoices SET paid_via = (SELECT method FROM charges)`);',
    },
    {
      ruta: 'fixture/backfill-indirecto.ts',
      texto: 'const data = { paidVia: cobroDeLaPasarela.method }; await prisma.invoice.update({ data });',
    },
  ];

  for (const f of fixtures) {
    const h = buscarBackfill([f]);
    assert.ok(h.length > 0,
      `🔴 EL DETECTOR ESTÁ CIEGO para «${f.ruta}»: no ve un backfill que está escrito delante. ` +
      'El cero del test de abajo no significaría «no hay», significaría «no sé mirar».');
  }

  // Y el hallazgo tiene que NOMBRAR lo que encontró: un rojo que no dice dónde no sirve de nada.
  const uno = buscarBackfill([fixtures[0]])[0];
  assert.match(describir(uno), /backfill-sql\.sql:\d+/, '🔴 el hallazgo no dice fichero y línea.');
  assert.match(describir(uno), /charges/i, '🔴 el hallazgo no nombra de dónde se copiaba.');
});

// ── CONTROL NEGATIVO ─────────────────────────────────────────────────────────────────────────

test('SCRUM-441 · CONTROL NEGATIVO: escribir el método SIN copiarlo de Charge no salta', () => {
  const legitimos = [
    {
      // El caso que este ticket habilita: el profesional marca a mano y DECLARA cómo cobró.
      ruta: 'fixture/legitimo-declarado.ts',
      texto: 'await prisma.invoice.update({ where: { id }, data: { status, paidAt, paidVia: declarado } });',
    },
    {
      // Leer la columna no es escribirla.
      ruta: 'fixture/legitimo-lectura.ts',
      texto: 'const { paidVia } = await prisma.invoice.findUnique({ select: { paidVia: true } });',
    },
    {
      // Un fichero que hable de `charges` en un sitio y de `paid_via` en OTRA sentencia no es
      // un backfill: si esto saltara, el guard sería ruido y acabaría desactivado.
      ruta: 'fixture/legitimo-dos-sentencias.sql',
      texto: 'ALTER TABLE invoices ADD COLUMN paid_via TEXT;\nSELECT count(*) FROM charges;',
    },
  ];

  for (const f of legitimos) {
    const h = buscarBackfill([f]);
    assert.deepEqual(h, [],
      `🔴 falso positivo en «${f.ruta}»: ${h.map(describir).join(' | ')}. Un guard que grita por ` +
      'lo legítimo se acaba apagando, y entonces no protege de nada.');
  }
});

// ── EL GUARD ─────────────────────────────────────────────────────────────────────────────────

test('SCRUM-441 · 🔴 NADIE rellena `invoices.paid_via` copiándolo de `Charge.method`', () => {
  const entradas = entradasDelArbol();

  // El suelo del BARRIDO, aparte del suelo del detector: si no se ha leído ningún fichero, el cero
  // de abajo sería el de una carpeta vacía.
  assert.ok(entradas.length > 100,
    `🔴 solo se han leído ${entradas.length} ficheros: el barrido no está mirando el árbol.`);

  const hallazgos = buscarBackfill(entradas);
  assert.deepEqual(hallazgos.map(describir), [],
    '🔴 HAY UN BACKFILL DE `paid_via` DESDE `Charge`:\n    ' +
    hallazgos.map(describir).join('\n    ') +
    '\n\n  `Charge.method` guardó A LA VEZ la intención del profesional (`card`) y el hecho que ' +
    'escribió la pasarela (`card:stripe`), y mirando una fila NO se puede saber cuál de las dos es. ' +
    'Copiar esa columna a `invoices` no mueve ese defecto: lo DUPLICA, y de forma irreversible — ' +
    'una vez copiadas las filas, ya nadie puede distinguir cuáles se copiaron.\n' +
    '  La columna entra VACÍA y se rellena solo hacia adelante. `NULL` significa «no consta», que ' +
    'es la verdad, y el lector ya lo trata bien.');
});

test('SCRUM-441 · las excepciones son VISIBLES', () => {
  assert.deepEqual(ALLOWLIST, [],
    `🔴 la ALLOWLIST del detector trae ${ALLOWLIST.length} excepción(es): ${ALLOWLIST.join(', ')}. ` +
    'Que existan no es el problema — que entren sin que nadie las lea, sí. Si son legítimas, este ' +
    'test se actualiza en el mismo commit y el motivo queda escrito al lado.');
});

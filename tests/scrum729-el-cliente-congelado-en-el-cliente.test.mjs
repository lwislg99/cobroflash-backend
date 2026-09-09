// tests/scrum729-el-cliente-congelado-en-el-cliente.test.mjs — SCRUM-729 (paso 6)
//
// Sin gate y SIN BASE: lee el DMMF que el cliente de Prisma lleva dentro. No abre ninguna
// conexión, no consulta ninguna tabla, no necesita `DATABASE_URL`.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 QUÉ IMPIDE ESTO, Y POR QUÉ MIRA EL CLIENTE Y NO EL `schema.prisma`
//
// Las diez columnas ya existen en las tres bases (ALTER aplicado y verificado). Lo que este paso
// añadió son las diez líneas del esquema que las hacen ALCANZABLES desde el código.
//
// Comprobar que esas líneas están escritas en `prisma/schema.prisma` sería medir LA FORMA. Lo que
// decide es EL HECHO: que los campos hayan llegado al cliente GENERADO, que es lo que el producto
// importa en tiempo de ejecución. Entre las dos cosas hay un `prisma generate` que puede no
// haberse corrido, haber fallado a medias, o haber generado contra otro esquema.
//
// Es la distinción que ya mordió en el ancla de medición de SCRUM-267: «está escrito» y «es cierto»
// no son la misma afirmación, y sólo la segunda protege a nadie.
//
// ── 🔴 Y EL `@map` ES LA MITAD QUE IMPORTA ───────────────────────────────────────────────
// Sin `@map`, Prisma buscaría una columna llamada `"customerName"` —camello, entre comillas— que NO
// EXISTE en la base: las columnas se aplicaron en guiones bajos (`customer_name`). El fallo no
// aparecería aquí ni al compilar: aparecería en la PRIMERA CONSULTA que pidiera el campo, en
// producción, sobre el documento de un profesional.
//
// Y es un error fácil de cometer sin querer, porque esta tabla invita a ello: `invoices` mezcla
// convenciones —`merchantId`, `customerId` y `quoteId` van SIN `@map`, en camello— así que copiar
// el estilo del vecino de arriba produce exactamente el campo roto.
//
// ⛔ ESTO NO COMPRUEBA QUE NADIE LOS RELLENE, y es deliberado: el escritor que copie estos valores
// al emitir es camino de emisión fiscal → STOP del fundador (regla 38 y 40). Este paso deja los
// campos disponibles y VACÍOS. Un test que exigiera contenido estaría pidiendo código que no
// existe y que esta sesión tiene prohibido escribir.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';

/** Los cinco campos y la columna física que cada uno TIENE que nombrar. */
const CAMPOS = Object.freeze({
  customerName: 'customer_name',
  customerLegalName: 'customer_legal_name',
  customerTaxId: 'customer_tax_id',
  customerEmail: 'customer_email',
  customerPhone: 'customer_phone',
});

/** Los dos modelos que congelan al cliente, con la tabla en la que se aplicó el ALTER. */
const MODELOS = Object.freeze({ Invoice: 'invoices', Albaran: 'albaranes' });

const modeloDe = (nombre) => Prisma.dmmf.datamodel.models.find((m) => m.name === nombre);

// ═══ ① SUELO — sin esto, todo lo de abajo sería cierto sobre un cliente vacío ═════════════

test('SCRUM-729 · 🔴 SUELO: el DMMF del cliente generado se lee y trae los dos modelos', () => {
  assert.ok(Prisma.dmmf?.datamodel?.models?.length > 20,
    `🔴 CLIENTE CIEGO: el DMMF trae ${Prisma.dmmf?.datamodel?.models?.length} modelos. Si no se lee,\n`
    + '   las comprobaciones de abajo pasarían sobre la nada y un campo perdido no se vería.');
  for (const [modelo, tabla] of Object.entries(MODELOS)) {
    const m = modeloDe(modelo);
    assert.ok(m, `🔴 el cliente no conoce \`model ${modelo}\`.`);
    assert.equal(m.dbName ?? m.name, tabla,
      `🔴 \`${modelo}\` ya no mapea a la tabla \`${tabla}\`, sino a \`${m.dbName ?? m.name}\`.\n`
      + '   El ALTER se aplicó sobre esa tabla: si el modelo apunta a otra, las diez columnas\n'
      + '   nuevas están en un sitio y el código las busca en otro.');
  }
});

// ═══ ② LOS DIEZ CAMPOS EXISTEN EN EL CLIENTE ═════════════════════════════════════════════

test('SCRUM-729 · 🔴 los CINCO campos llegaron al cliente, en los DOS modelos', () => {
  const ausentes = [];
  for (const modelo of Object.keys(MODELOS)) {
    const m = modeloDe(modelo);
    for (const campo of Object.keys(CAMPOS)) {
      if (!m.fields.some((f) => f.name === campo)) ausentes.push(`${modelo}.${campo}`);
    }
  }
  assert.deepEqual(ausentes, [],
    '🔴 FALTAN CAMPOS EN EL CLIENTE GENERADO:\n'
    + ausentes.map((x) => '       ' + x).join('\n')
    + '\n\n   Las columnas SÍ existen en las tres bases (ALTER de SCRUM-729, aplicado y verificado).\n'
    + '   Lo que falta es que el esquema las declare y que se haya corrido `prisma generate`.\n'
    + '   Sin esto el dato está en la base y el código no puede ni leerlo ni escribirlo.');
});

// ═══ ③ Y CADA UNO NOMBRA SU COLUMNA — el `@map`, que es donde está el peligro ═════════════

test('SCRUM-729 · 🔴 cada campo nombra su columna en guiones bajos (el `@map`)', () => {
  const mal = [];
  for (const modelo of Object.keys(MODELOS)) {
    const m = modeloDe(modelo);
    for (const [campo, columna] of Object.entries(CAMPOS)) {
      const f = m.fields.find((x) => x.name === campo);
      if (!f) continue; // lo acusa el test ②; aquí no se duplica el fallo
      if (f.dbName !== columna) {
        mal.push(`${modelo}.${campo} → apunta a ${JSON.stringify(f.dbName)}, y la columna es "${columna}"`);
      }
    }
  }
  assert.deepEqual(mal, [],
    '🔴 UN CAMPO HA PERDIDO SU `@map`:\n'
    + mal.map((x) => '       ' + x).join('\n')
    + '\n\n   `dbName: null` significa que Prisma usará el nombre del campo TAL CUAL: buscaría\n'
    + '   `"customerName"` en camello y entre comillas, y esa columna NO EXISTE — el ALTER las creó\n'
    + '   en guiones bajos. No falla al compilar ni aquí: falla en la PRIMERA CONSULTA que pida el\n'
    + '   campo, en producción, sobre el documento de un profesional.\n'
    + '   Ojo al vecino de arriba: `merchantId`/`customerId`/`quoteId` van SIN `@map` en `invoices`,\n'
    + '   y copiar su estilo produce exactamente este defecto.');
});

// ═══ ④ Y SIGUEN SIENDO OPCIONALES — «no consta» tiene que poder existir ═══════════════════

test('SCRUM-729 · 🔴 los diez son OPCIONALES: `NULL` = «no consta»', () => {
  const obligatorios = [];
  for (const modelo of Object.keys(MODELOS)) {
    const m = modeloDe(modelo);
    for (const campo of Object.keys(CAMPOS)) {
      const f = m.fields.find((x) => x.name === campo);
      if (f && f.isRequired) obligatorios.push(`${modelo}.${campo}`);
    }
  }
  assert.deepEqual(obligatorios, [],
    '🔴 HAY CAMPOS OBLIGATORIOS:\n'
    + obligatorios.map((x) => '       ' + x).join('\n')
    + '\n\n   Las columnas son `is_nullable = YES` con `default NULL`, y todos los documentos ya\n'
    + '   emitidos las tienen vacías (`con_dato = 0`, verificado al aplicar el ALTER). Un campo\n'
    + '   obligatorio en el cliente haría fallar la creación de CUALQUIER factura o albarán nuevo,\n'
    + '   y además borraría la distinción que este ticket existe para guardar: «no consta» no es\n'
    + '   un valor que haya que inventar.');
});

// ═══ ⑤ CONTROL NEGATIVO — el detector sabe decir que NO ══════════════════════════════════

test('SCRUM-729 · ✅ CONTROL NEGATIVO: los detectores cazan lo que persiguen', () => {
  // Sin esto, «todos bien» y «el detector no mira» dan el mismo verde. Se ejercita la MISMA
  // comprobación sobre un modelo de mentira, sin tocar el cliente de verdad.
  const falso = {
    name: 'Invoice',
    dbName: 'invoices',
    fields: [
      { name: 'customerName', dbName: null, isRequired: false },        // perdió el @map
      { name: 'customerLegalName', dbName: 'customer_legal_name', isRequired: true }, // obligatorio
      { name: 'customerTaxId', dbName: 'customer_tax_id', isRequired: false },
      // customerEmail y customerPhone: AUSENTES
    ],
  };
  const ausentes = Object.keys(CAMPOS).filter((c) => !falso.fields.some((f) => f.name === c));
  assert.deepEqual(ausentes, ['customerEmail', 'customerPhone'],
    '🔴 el detector de ausencias no ve los dos campos que faltan.');

  const sinMap = Object.entries(CAMPOS)
    .filter(([c, col]) => { const f = falso.fields.find((x) => x.name === c); return f && f.dbName !== col; })
    .map(([c]) => c);
  assert.deepEqual(sinMap, ['customerName'], '🔴 el detector de `@map` no ve el campo sin mapear.');

  const obligatorios = falso.fields.filter((f) => f.isRequired).map((f) => f.name);
  assert.deepEqual(obligatorios, ['customerLegalName'],
    '🔴 el detector de obligatorios no ve el campo que lo es.');
});

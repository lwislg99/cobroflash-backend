// tests/scrum665b-el-esquema-declara.test.mjs — SCRUM-665 (B)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL PASO ③: EL ESQUEMA DECLARA LAS SIETE COLUMNAS QUE LAS TRES BASES YA TIENEN
// ═════════════════════════════════════════════════════════════════════════════════════════════
//
// El orden de la casa es ① decisión → ② ALTER aditivo en las tres bases → ③ un PR con esquema +
// código + tests. ② está hecho y verificado con dos controles de tipos distintos (producción y
// staging por el fundador; desarrollo el 17-sep-2026, ver `docs/MIGRATIONS_PENDING.md`).
//
// Este fichero vigila ③ y el control que lo decide: **el papel**. No basta con que el esquema
// nombre las columnas — hay que ver que el documento deja de reimprimirse con datos de hoy.
//
// ── 🔴 LO QUE ESTE FICHERO NO PUEDE DECIR, y es lo más importante ──────────────────────────
// NO dice que el producto use ya el emisor congelado. Medido el 17-sep-2026: **nadie llama a
// `emisorDelDocumento` en todo `src/`**. `src/lib/invoicing.ts:108` y `:249` siguen pasando el
// perfil VIVO a `generateInvoicePdf`, justo al lado de `customer: clienteDelDocumento(...)`, que
// es el gemelo ya enchufado (SCRUM-729). Ese enchufe MODIFICA el camino de emisión fiscal, así
// que es STOP (regla 38) y NO se hace aquí: se nombra en el expediente con fichero y línea.
//
// Por eso el papel se ejercita pasándole a `generateInvoicePdf` lo que el lector devuelve — que es
// exactamente lo que el enchufe produciría— sin tocar una línea de `src/`.
//
// ── Y POR CONTENIDO, NO POR BYTES ─────────────────────────────────────────────────────────
// El PDF no es determinista: lleva fecha de creación y un id propio, así que dos pasadas idénticas
// dan bytes distintos. Comparar tamaños fue el defecto que SCRUM-604 vino a quitar («un desglose
// fiscal con la cuota equivocada pesa exactamente lo mismo que uno correcto»). Se lee el TEXTO con
// `extraerTextoPdf`, que además se declara CIEGO si no sabe leerlo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { extraerTextoPdf } from './_texto-del-pdf.mjs';
import { normalizar } from './_pdf-texto.mjs';
// 🔴 El teléfono sale del RANGO IMPOSIBLE (prefijo 340), no de `+34 6XX`. Lo cazó `scrum262`:
// `+34 6XX` es móvil español ordinario y puede estar asignado a alguien que no ha pedido nada, y
// hay tres crons que envían WhatsApp a teléfonos guardados sin filtrar por merchant demo. Aquí el
// número no llega a la base — pero el guard es categórico a propósito, y tiene razón.
import { telefonoDePrueba } from '../scripts/_telefonos-prueba.mjs';

const { emisorDelDocumento, congelarEmisor, CAMPOS_CONGELADOS_EMISOR } =
  await import('../dist/modules/invoicing/domain/emisorCongelado.js');
const { generateInvoicePdf } = await import('../dist/lib/pdf.js');
const { Prisma } = await import('@prisma/client');

// ── Las dos fichas: la de ENTONCES (la que se congeló) y la de HOY (el perfil corregido) ─────
const DIRECCION_DE_ENTONCES = 'C/ Mayor 1, 28013 Madrid';
const DIRECCION_DE_HOY = 'Av. Nueva 99, 08001 Barcelona';
const ficha = (address) => ({
  name: 'Fontanería QA', legalName: 'Fontanería QA SL', taxId: 'B00000000',
  address, logoUrl: null, phone: telefonoDePrueba(1), email: 'qa@test.local',
});

/** Pinta el papel con el emisor que se le dé y devuelve su TEXTO. */
async function papelCon(emisor) {
  const num = 'F26' + crypto.randomBytes(3).toString('hex').toUpperCase();
  const { outPath } = await generateInvoicePdf({
    number: num,
    merchant: {
      name: emisor.name, legalName: emisor.legalName, taxId: emisor.taxId,
      address: emisor.address, logoUrl: emisor.logoUrl, phone: emisor.phone, email: emisor.email,
    },
    customer: { name: 'Cliente QA' },
    currency: 'EUR', total: '150.00', qrData: 'x', type: 'JUST',
    lines: [{ concept: 'Trabajo de prueba', qty: 1, price: 150, tax: 0 }],
  });
  try {
    // ⚠️ `extraerTextoPdf` devuelve `{ok, texto}` — NO una cadena. Tratarlo como cadena hace que
    // `.includes(...)` sea `undefined.includes` o siempre falso, y entonces el control diría
    // «el papel no dice eso» cuando lo que pasa es que no lo estoy leyendo. Lo cazó mi propio
    // suelo en la primera pasada, que para eso está.
    const r = extraerTextoPdf(fs.readFileSync(outPath));
    if (!r.ok) return { ok: false, motivo: r.motivo, texto: '' };
    return { ok: true, texto: normalizar(r.texto) };
  } finally {
    fs.rmSync(outPath, { force: true });
  }
}

/** ¿Dice el papel esto? Comparado NORMALIZADO: las tildes salen en la codificación del PDF. */
const dice = (papel, aguja) => papel.texto.includes(normalizar(aguja));

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① EL ESQUEMA · las siete, declaradas y NULLABLE, leídas del DMMF y no del fichero
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-665b · el esquema declara LAS SIETE del emisor, con su @map y NULLABLE', () => {
  const invoice = Prisma.dmmf.datamodel.models.find((m) => m.name === 'Invoice');
  assert.ok(invoice, '🔴 CIEGO: el DMMF no trae el modelo `Invoice`; no estoy mirando el esquema.');
  assert.ok(invoice.fields.length > 20,
    `🔴 CIEGO: el modelo trae ${invoice.fields.length} campos. No estoy leyendo el esquema real.`);

  // La lista sale del MÓDULO, no se reescribe aquí: `CAMPOS_CONGELADOS_EMISOR` es la lista única
  // sobre la que cuentan el escritor, el lector y el test de 665a. Copiarla haría dos listas.
  assert.equal(CAMPOS_CONGELADOS_EMISOR.length, 7);
  const porNombre = new Map(invoice.fields.map((f) => [f.name, f]));

  for (const campo of CAMPOS_CONGELADOS_EMISOR) {
    const f = porNombre.get(campo);
    assert.ok(f, `🔴 el esquema NO declara \`${campo}\`, y la columna SÍ está en las tres bases.`);
    assert.equal(f.type, 'String', `🔴 \`${campo}\` no es String en el esquema: ${f.type}`);
    // 🔴 EL CENTINELA. `merchantName` nace NULLABLE aunque en `Merchant` sea NOT NULL: ese `null`
    // es lo único que distingue «factura anterior al escritor» de «factura sin nombre».
    assert.equal(f.isRequired, false,
      `🔴 \`${campo}\` está declarado NOT NULL. Si es \`merchantName\`, eso convierte el centinela `
      + 'de `emisorDelDocumento` en basura y las facturas viejas dejan de distinguirse de las rotas.');
    const esperado = campo.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
    assert.equal(f.dbName, esperado,
      `🔴 \`${campo}\` mapea a \`${f.dbName}\` y la columna real es \`${esperado}\`.`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② 🔴 EL QUE DECIDE · MITAD 1 — con las siete columnas, el papel NO cambia
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-665b · 🔴 con las siete columnas, cambiar el perfil NO cambia el papel', async () => {
  const doc = congelarEmisor(ficha(DIRECCION_DE_ENTONCES));
  assert.equal(doc.merchantAddress, DIRECCION_DE_ENTONCES, 'suelo: el escritor copió la dirección');

  // El mismo documento, leído ANTES y DESPUÉS de que el profesional corrija su perfil.
  const antes = await papelCon(emisorDelDocumento(doc, ficha(DIRECCION_DE_ENTONCES)));
  const despues = await papelCon(emisorDelDocumento(doc, ficha(DIRECCION_DE_HOY)));

  // 🔴 SUELO: si el extractor no supiera leer, las dos comparaciones de abajo pasarían por
  // construcción. Se exige que el papel diga algo que sabemos que dice.
  assert.ok(antes.ok && antes.texto.length > 50,
    '🔴 CIEGO: no he podido leer el texto del PDF. `extraerTextoPdf` se declara ciego cuando el '
    + `documento embebe un tipo propio; entonces esto no mide nada. Motivo: ${antes.motivo || ''}`);
  assert.ok(dice(antes, 'Fontaneria'),
    `🔴 CIEGO: el papel no trae ni el nombre del emisor. Texto leído: ${antes.texto.slice(0, 160)}`);

  assert.ok(dice(antes, 'Mayor 1'),
    '🔴 el papel no trae la dirección congelada, así que no puedo saber si cambia.');
  assert.ok(dice(despues, 'Mayor 1'),
    '🔴 EL PAPEL SE HA REIMPRESO CON LOS DATOS DE HOY. Con las siete columnas puestas, corregir '
    + 'el perfil NO puede cambiar una factura ya emitida (regla 29).');
  assert.ok(!dice(despues, 'Nueva 99'),
    '🔴 la dirección NUEVA ha entrado en el papel de una factura vieja.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ③ ✅ MITAD 2 — la misma fila a NULL: el papel SÍ cambia
//    Sin esta mitad habría escrito un «nunca cambia» que pasa por no mirar nada.
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-665b · ✅ la MISMA fila con `merchantName` a NULL: el papel SÍ cambia', async () => {
  // Una factura anterior al escritor: sin copia. El lector cae a la ficha viva, que es lo que debe.
  const docViejo = {};
  const antes = await papelCon(emisorDelDocumento(docViejo, ficha(DIRECCION_DE_ENTONCES)));
  const despues = await papelCon(emisorDelDocumento(docViejo, ficha(DIRECCION_DE_HOY)));

  assert.ok(antes.ok, `🔴 CIEGO: ${antes.motivo || ''}`);
  assert.ok(dice(antes, 'Mayor 1'), 'suelo: el primer papel trae la dirección de entonces');
  assert.ok(dice(despues, 'Nueva 99'),
    '🔴 EL CONTROL NO DISTINGUE: sin copia, el papel TIENE que seguir el perfil vivo. Si aquí no '
    + 'cambiara, la mitad de arriba estaría pasando porque el papel nunca cambia, no porque las '
    + 'columnas lo congelen.');
  assert.ok(!dice(despues, 'Mayor 1'),
    '🔴 sin copia, el papel sigue trayendo la dirección vieja: entonces no viene del perfil vivo.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ④ El lector sigue dando lo mismo que en 665a — declarar el esquema no lo ha movido
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-665b · el lector y el escritor siguen dando el MISMO resultado que en 665a', () => {
  const doc = congelarEmisor(ficha(DIRECCION_DE_ENTONCES));
  const leido = emisorDelDocumento(doc, ficha(DIRECCION_DE_HOY));
  assert.equal(leido.congelado, true);
  assert.equal(leido.address, DIRECCION_DE_ENTONCES);

  const sinCopia = emisorDelDocumento({}, ficha(DIRECCION_DE_HOY));
  assert.equal(sinCopia.congelado, false);
  assert.equal(sinCopia.address, DIRECCION_DE_HOY);

  // Y el suelo del propio lector, que 665a fijó: sin copia y sin ficha se FALLA, no se pinta un
  // documento fiscal con el emisor en blanco.
  assert.throws(() => emisorDelDocumento({}, null), /documento_sin_emisor_congelado_ni_ficha_viva/);
});

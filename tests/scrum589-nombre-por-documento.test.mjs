// tests/scrum589-nombre-por-documento.test.mjs — SCRUM-589 (CONT-18)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// CON QUÉ NOMBRE SALE EL CLIENTE EN EL DOCUMENTO — ahora lo elige el profesional.
//
// Hasta hoy la razón social SUSTITUÍA al nombre siempre que existiera y no había forma de
// evitarlo. La elección vive en `Quote.docFields`, que ya era `Json`: cero migración.
//
// ── LAS TRES TRAMPAS MUDAS QUE ESTE TICKET TUVO QUE ABRIR ────────────────────────────────
// Ninguna se veía desde fuera y las tres habrían dejado el ticket «hecho» y sin efecto:
//
//   1. `z.object` ESTRAGA las claves que no declara, con `ok: true`. Medido antes de tocarlo
//      contra el esquema importado de `dist/`: entraba `{…, usarRazonSocial:false}` y salía
//      `{name,phone,taxId,email}`. El navegador la mandaba, el servidor decía que sí, y la
//      elección no llegaba nunca a la fila.
//   2. El front no enviaba `docFields` cuando las cuatro casillas estaban marcadas
//      (`if (all) return undefined`) — o sea, en el caso más común la elección se perdía
//      antes de salir del navegador.
//   3. La nota del bloque AFIRMABA la sustitución automática como un hecho. Con la elección
//      delante pasaba a ser falsa; el asesor firmó la corrección.
//
// ── QUÉ VIGILA ESTE FICHERO Y QUÉ NO ────────────────────────────────────────────────────
// El MECANISMO, que es estático y no caduca. La CAJA la mide
// `npm run guard:caja-datos-del-cliente` en navegador (la suite no arranca uno), y el papel
// —que el nombre CAMBIE EN EL PDF— se midió generando el documento en los dos sentidos y
// leyendo el texto del PDF inflado; queda en el parte del ticket.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { soloEjecutable } from './_guard-texto.mjs';
import { nombreParaDocumento } from '../dist/core/documentos/nombreParaDocumento.js';
import { CreateQuoteSchema } from '../dist/core/validation/schemas.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VISTA = 'public/dashboard/js/quotesView.js';
const leer = (rel) => {
  try { return fs.readFileSync(path.join(RAIZ, rel), 'utf8'); } catch (e) {
    assert.fail(`🔴 no se pudo leer ${rel} (${e && e.code ? e.code : e}). «Está bien» y «no supe ` +
      'mirar» son el mismo verde.');
  }
};

// ─────────────────────────────────────────────────────────────────────────────────────────
// 1 · LA REGLA — un solo sitio, y las dos direcciones caen al otro nombre
// ─────────────────────────────────────────────────────────────────────────────────────────
const EMPRESA = { name: 'Talleres Paco', legalName: 'Talleres Paco S.L.' };

test('SCRUM-589 · la elección invierte la PREFERENCIA, no el respaldo', () => {
  // Por defecto (sin opciones) manda la razón social: es lo de siempre.
  assert.equal(nombreParaDocumento(EMPRESA, '—'), 'Talleres Paco S.L.');
  assert.equal(nombreParaDocumento(EMPRESA, '—', { usarRazonSocial: true }), 'Talleres Paco S.L.');
  // Elegida la comercial, manda la comercial.
  assert.equal(nombreParaDocumento(EMPRESA, '—', { usarRazonSocial: false }), 'Talleres Paco');

  // 🔴 LOS DOS SENTIDOS CAEN AL OTRO NOMBRE. Un cliente al que le falta uno de los dos NO se
  // queda sin nombre en el papel teniendo el otro a mano.
  const soloComercial = { name: 'Talleres Paco', legalName: null };
  const soloLegal = { name: '', legalName: 'Talleres Paco S.L.' };
  for (const opt of [{ usarRazonSocial: true }, { usarRazonSocial: false }, undefined]) {
    assert.equal(nombreParaDocumento(soloComercial, '—', opt), 'Talleres Paco',
      'un cliente SIN razón social sale con su nombre comercial elija lo que elija');
    assert.equal(nombreParaDocumento(soloLegal, '—', opt), 'Talleres Paco S.L.',
      'un cliente SIN nombre sale con su razón social elija lo que elija');
  }

  // El respaldo se respeta y no lo toca la elección.
  assert.equal(nombreParaDocumento({ name: '', legalName: '' }, '—', { usarRazonSocial: false }), '—');
  assert.equal(nombreParaDocumento(null, null, { usarRazonSocial: false }), null);
});

test('SCRUM-589 · ✅ REBOTE: lo que NO trae el campo se comporta como antes del ticket', () => {
  // Los documentos ya guardados llegan con `docFields` a `null` o con las cuatro claves de
  // siempre. Ninguna de las dos formas puede cambiar el nombre impreso.
  const comoAntes = nombreParaDocumento(EMPRESA, '—');
  for (const opt of [undefined, null, {}, { usarRazonSocial: undefined }, { usarRazonSocial: null },
    { name: true, phone: true, taxId: true, email: true }]) {
    assert.equal(nombreParaDocumento(EMPRESA, '—', opt), comoAntes,
      `🔴 con ${JSON.stringify(opt)} el nombre cambia. Un presupuesto de la semana pasada ` +
      'cambiaría de nombre al reimprimirlo, y eso para el ticket.');
  }
  // CONTROL POSITIVO: el único valor que SÍ cambia es el `false` explícito. Sin esto, un
  // «nada lo cambia» podría significar que la opción no hace nada en absoluto.
  assert.notEqual(nombreParaDocumento(EMPRESA, '—', { usarRazonSocial: false }), comoAntes,
    '🔴 ni siquiera `false` cambia el nombre: la elección no está conectada.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// 2 · EL VALIDADOR — la trampa muda que decidía el ticket
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-589 · 🔴 el validador NO se traga la elección en silencio', () => {
  const campo = CreateQuoteSchema.shape.docFields;
  assert.ok(campo, 'el esquema de creación de presupuesto ya no tiene `docFields`');

  const entrada = { name: true, phone: false, taxId: true, email: true, usarRazonSocial: false };
  const r = campo.safeParse(entrada);
  assert.equal(r.success, true, 'el validador rechaza una entrada legítima');
  assert.ok('usarRazonSocial' in r.data,
    '🔴 `usarRazonSocial` desaparece al validar. `z.object` estraga lo que no declara Y DEVUELVE ' +
    '`ok: true`: el navegador la manda, el servidor contesta 2xx y la elección no llega a la ' +
    'fila. Es el defecto que este ticket vino a abrir, con todos los tests en verde.');
  assert.equal(r.data.usarRazonSocial, false, 'llega, pero con otro valor');

  // CONTROL POSITIVO: una clave conocida sigue pasando (el validador no lo deja pasar todo).
  assert.equal(r.data.taxId, true);
  // CONTROL NEGATIVO: ahora que está declarada, un tipo malo SÍ se rechaza. Antes NO se
  // rechazaba —se estragaba antes de mirarle el tipo—, así que esto también es nuevo.
  assert.equal(campo.safeParse({ usarRazonSocial: 'no soy booleano' }).success, false,
    '🔴 acepta un `usarRazonSocial` que no es booleano');
  // Y sigue admitiendo `null` y la ausencia, que es como llegan los documentos viejos.
  assert.equal(campo.safeParse(null).success, true);
  assert.equal(campo.safeParse({ name: true }).success, true);
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// 3 · EL FRONT — que la elección SALGA del navegador, y una sola fuente
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-589 · el atajo del payload ya no puede perder la elección', () => {
  const src = leer(VISTA);
  // El atajo sigue existiendo —no se borra, se ESTRECHA— pero ahora exige las dos cosas.
  assert.ok(/if \(all && usarRazonSocial\) return undefined;/.test(src),
    '🔴 el atajo ha vuelto a ser `if (all) return undefined`. Con las cuatro casillas marcadas ' +
    '—el caso más común— la elección se pierde antes de salir del navegador.');
  assert.ok(/out\.usarRazonSocial = usarRazonSocial;/.test(src),
    '🔴 `selectedDocFields()` ya no mete la elección en el objeto que viaja.');
  // Y el payload sigue llamándose igual: el guard de SCRUM-286 muta esta línea exacta.
  assert.ok(/docFields: selectedDocFields\(\),/.test(src),
    '🔴 ha cambiado la llamada del payload; el guard de SCRUM-286 muta esa línea literal.');
});

test('SCRUM-589 · los radios son EXCLUYENTES, con el defecto en «Razón social»', () => {
  const src = leer(VISTA);
  const defs = [...src.matchAll(/\{\s*valor:\s*"(\w+)",\s*label:\s*"([^"]+)"\s*\}/g)].map((m) => ({ valor: m[1], label: m[2] }));
  assert.deepEqual(defs, [
    { valor: 'legal', label: 'Razón social' },
    { valor: 'comercial', label: 'Nombre comercial' },
  ], '🔴 han cambiado las dos opciones o su orden. Los textos los firmó el asesor el 6-sep-2026.');

  // Excluyentes de verdad: mismo `name`, y son radios.
  assert.ok(/r\.type = "radio";/.test(src) && /r\.name = "df-nombre";/.test(src),
    '🔴 la elección ha dejado de ser un par de radios con el mismo `name`: si vuelven a ser ' +
    'casillas, existen otra vez las combinaciones sin respuesta que este ticket vino a evitar.');

  // 🔴 EL DEFECTO ES «Razón social»: es lo que el formulario hacía HOY.
  assert.ok(/r\.checked = def\.valor === "legal";/.test(src),
    '🔴 el radio por defecto ha dejado de ser «Razón social». Cambiarlo alteraría en silencio el ' +
    'nombre impreso de todos los presupuestos nuevos de quien tenga razón social rellena.');

  // Con ☐Nombre se DESHABILITAN, no se esconden.
  assert.ok(/disabled = !activo/.test(src) && !/dfNombreRow\.style\.display/.test(src),
    '🔴 la elección se esconde en vez de deshabilitarse: la fila entera saltaría al marcar la ' +
    'casilla y el profesional no sabría que la opción existe.');
});

test('SCRUM-589 · la nota ya no afirma la sustitución automática', () => {
  const src = leer(VISTA);
  const nota = (src.match(/dfNote\.textContent\s*=\s*"([^"]+)"/) || [])[1];
  assert.equal(nota, 'Solo aparecen los que el cliente tenga rellenos. Elige con qué nombre sale este cliente en el documento.',
    '🔴 la nota no es la firmada por el asesor (6-sep-2026).');
  // 🔴 SÓLO CÓDIGO EJECUTABLE, y me lo he vuelto a hacer: la primera versión miraba el fuente
  // crudo y salió roja por MI PROPIO COMENTARIO, que cita la frase vieja para explicar por qué
  // se retiró. Es el mismo defecto que ya cacé en SCRUM-776 y que SCRUM-601 documentó al cerrar.
  assert.ok(!/sustituye al nombre/.test(soloEjecutable(src)),
    '🔴 ha vuelto la frase «la razón social sustituye al nombre si existe». Con la elección ' +
    'delante esa afirmación es FALSA: le dice al profesional que no puede decidir algo que sí decide.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// 4 · UN SOLO SITIO — que nadie reimplemente la preferencia
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-589 · 🔴 quien imprime el nombre NO decide: se lo pregunta a la regla', () => {
  const pdf = leer('src/modules/invoicing/infra/pdf/pdf.service.ts');
  // El PDF del presupuesto pasa `docFields` TAL CUAL; no mira el booleano por su cuenta.
  assert.ok(/nombreParaDocumento\(params\.customer, '—', params\.docFields\)/.test(pdf),
    '🔴 el PDF del presupuesto ha dejado de pasarle la elección a la regla.');
  assert.ok(!/docFields\??\.\s*usarRazonSocial/.test(pdf),
    '🔴 `pdf.service.ts` interpreta `usarRazonSocial` por su cuenta. Dos sitios decidiendo el ' +
    'nombre del cliente es la regla 2 esperando a morder.');

  // ⛔ Y LA FACTURA NO SE TOCA: es camino de emisión y no tiene `docFields`.
  assert.ok(/nombreParaDocumento\(params\.customer, params\.customer\.name\)/.test(pdf),
    '🔴 la llamada de `generateInvoicePdf` ha cambiado. Es camino de emisión: sin opciones, la ' +
    'regla le devuelve lo de siempre, y así tiene que seguir.');
});

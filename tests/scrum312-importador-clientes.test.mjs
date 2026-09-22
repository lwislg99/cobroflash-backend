// SCRUM-312 (D1) · EL IMPORTADOR DE CLIENTES.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE SE MIDIÓ ANTES DE CONSTRUIR, porque cambió la forma de la tarea
//
// El importador de clientes SÍ existía (`POST /admin/customers/import`), y el de productos se
// alineó A ÉL (`products.service.ts`: «contrato ALINEADO con POST /admin/customers/import»).
// Lo que NO existía era un solo test suyo — y sí existían **DOS parseos vivos** del mismo
// formato: `parseCsvLine` en el servidor (con los arreglos de SCRUM-339) y `csvSplitLine` en el
// navegador (sin ellos). El mismo fichero se leía distinto según por dónde entrara.
//
// Por eso esta tarea mueve el parseo al SERVIDOR y deja UNO: `core/csv/csv.ts`, el que ya usa
// productos. Los tests de productos fueron la red de la extracción y siguen en verde.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LOS TRES INNEGOCIABLES, UNO POR BLOQUE
//
//   ① CSV español: `;` y Windows-1252. Sin esto, 200 clientes entran como «Jos<?> Garc<?>a» y
//      el usuario lo descubre tres días después.
//   ② El mapeo se PROPONE leyendo la cabecera, no se exige plantilla.
//   ③ Nada se descarta en silencio: toda fila rechazada sale con su motivo, sin capar.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  decodificarCsv,
  proponerMapeo,
  normalizarCabecera,
  importarClientes,
  csvDeRechazos,
} from '../dist/modules/system/domain/importarClientes.service.js';
import { parsearLineaCsv, trocearCsv, quitarBom } from '../dist/core/csv/csv.js';

/**
 * Cliente de mentira: registra lo que se crea para poder afirmar sobre ello.
 *
 * SCRUM-1046: busca en `existentes` Y en lo ya `creados` en esta misma pasada — una base real
 * (READ COMMITTED, awaits secuenciales) SÍ vería la fila que acaba de crear la línea anterior del
 * mismo CSV, así que un doble no la ve el mock lo estaría dejando pasar por un motivo que no
 * existe en producción.
 */
function clienteFalso({ existentes = [] } = {}) {
  const creados = [];
  const casa = (e, o) =>
    (o.phone && e.phone === o.phone) ||
    (o.mobile && e.mobile === o.mobile) ||
    (o.email && e.email === o.email) ||
    (o.taxId?.equals && String(e.taxId ?? '').toUpperCase() === String(o.taxId.equals).toUpperCase());
  return {
    creados,
    findFirst: async ({ where }) => {
      const ors = where.OR ?? [];
      return [...existentes, ...creados].find((e) =>
        e.merchantId === where.merchantId && ors.some((o) => casa(e, o)),
      ) ?? null;
    },
    create: async ({ data }) => { creados.push(data); return { id: creados.length, ...data }; },
  };
}

const MAPEO = { name: 0, phone: 1, email: 2 };

// ═════════════════════════════════════════════════════════════════════════════
// ① CSV ESPAÑOL — separador `;` y Windows-1252
// ═════════════════════════════════════════════════════════════════════════════

test('① Windows-1252 se lee bien: «José García», no «Jos<?> Garc<?>a»', () => {
  // Los bytes EXACTOS que produce Excel en español. Es el caso del ticket.
  const bytes = Uint8Array.from([0x4a, 0x6f, 0x73, 0xe9, 0x20, 0x47, 0x61, 0x72, 0x63, 0xed, 0x61]);
  const d = decodificarCsv(bytes);
  assert.equal(d.codificacion, 'windows-1252', '🔴 detectado como UTF-8: entraría el mojibake');
  assert.equal(d.texto, 'José García');
});

test('① un CSV en UTF-8 se detecta como UTF-8 y no se estropea', () => {
  const d = decodificarCsv(new TextEncoder().encode('nombre;telefono\nJosé García;34000000004'));
  assert.equal(d.codificacion, 'utf-8');
  assert.match(d.texto, /José García/);
});

test('① la decisión NO se toma sola: devuelve la primera fila para que la juzgue una persona', () => {
  // «Si no se puede determinar, se pregunta»: un fichero solo-ASCII es idéntico en las dos, así
  // que la detección nunca es prueba. Por eso el contrato incluye qué enseñar y qué alternativa
  // ofrecer — es lo que sostiene la pantalla «¿Se ven bien los acentos?».
  const d = decodificarCsv(new TextEncoder().encode('nombre;telefono\r\nAna;34000000004'));
  assert.equal(d.primeraFila, 'nombre;telefono', '🔴 sin primera fila no hay nada que enseñar');
  assert.equal(d.alternativa, 'windows-1252', '🔴 sin alternativa, «prueba de otra forma» no puede hacer nada');
});

test('① «No, prueba de otra forma» reintenta con la OTRA codificación', () => {
  const bytes = new TextEncoder().encode('José');
  const auto = decodificarCsv(bytes);
  assert.equal(auto.codificacion, 'utf-8');
  const forzado = decodificarCsv(bytes, auto.alternativa);
  assert.equal(forzado.codificacion, 'windows-1252');
  assert.notEqual(forzado.texto, auto.texto, '🔴 forzar la otra no cambió nada: el botón no haría nada');
});

test('① el separador `;` de Excel español, y el BOM que él mismo pone', () => {
  const { separador, cabecera } = trocearCsv('﻿nombre;telefono;email\r\nAna;34000000004;a@b.c');
  assert.equal(separador, ';');
  assert.deepEqual(cabecera, ['nombre', 'telefono', 'email'], '🔴 el BOM se coló en la primera columna');
});

test('① un `;` DENTRO de una celda entrecomillada no parte la fila', () => {
  // El bug 3 de SCRUM-339, ahora compartido: sin esto las columnas se desplazan y el dato se
  // lee de la celda equivocada.
  assert.deepEqual(parsearLineaCsv('"Bar Pepe; SL";34000000004;a@b.c', ';'), ['Bar Pepe; SL', '34000000004', 'a@b.c']);
  assert.deepEqual(parsearLineaCsv('"Dice ""hola""";34000000004', ';'), ['Dice "hola"', '34000000004']);
});

test('① UN SOLO PARSEO: el del navegador ya no decide nada', () => {
  // La regla del ticket: si acaban existiendo dos implementaciones, la tarea está mal hecha.
  // Esto fija que las primitivas compartidas son las que se usan — el import de arriba
  // fallaría si `core/csv/csv.js` dejara de existir.
  assert.equal(typeof parsearLineaCsv, 'function');
  assert.equal(quitarBom('﻿x'), 'x');
});

// ═════════════════════════════════════════════════════════════════════════════
// ② EL MAPEO SE PROPONE — el Excel de un fontanero, en cualquier orden
// ═════════════════════════════════════════════════════════════════════════════

test('② propone leyendo la cabecera, en cualquier orden y con tildes', () => {
  const p = proponerMapeo(['TELÉFONO', 'Correo', 'NOMBRE']);
  assert.equal(p.find((c) => c.columna === 'NOMBRE').campo, 'name');
  assert.equal(p.find((c) => c.columna === 'TELÉFONO').campo, 'phone');
  assert.equal(p.find((c) => c.columna === 'Correo').campo, 'email');
});

test('② lo que NO reconoce lo DICE, no lo adivina', () => {
  const p = proponerMapeo(['NOMBRE', 'REFERENCIA_INTERNA_ANTIGUA']);
  const dir = p.find((c) => c.columna === 'REFERENCIA_INTERNA_ANTIGUA');
  assert.equal(dir.campo, null, '🔴 adivinar una columna que no se entiende es peor que preguntar');
  assert.equal(dir.confianza, 'ninguna');
});

test('② un campo no se propone DOS veces: TELEFONO y TLF (los dos sinónimos de teléfono fijo) no se pisan', () => {
  // Repartir el mismo campo entre dos columnas perdería una sin que se note.
  const p = proponerMapeo(['NOMBRE', 'TELEFONO', 'TLF']);
  assert.equal(p[1].campo, 'phone');
  assert.equal(p[2].campo, null, '🔴 la segunda columna de teléfono fijo se llevaría el campo');
});

// ═════════════════════════════════════════════════════════════════════════════
// SCRUM-1046 · NIF, MÓVIL, ETIQUETAS Y DIRECCIÓN — los cuatro campos nuevos
// ═════════════════════════════════════════════════════════════════════════════

test('② NIF, MÓVIL, ETIQUETAS y DIRECCIÓN se proponen — y MÓVIL ya no se confunde con TELÉFONO', () => {
  // 🔴 Antes «MOVIL» era sinónimo de `phone` porque no existía otro sitio: con `Customer.mobile`
  // ya en el esquema (SCRUM-590), MOVIL y TELEFONO tienen que ir a campos DISTINTOS, no pisarse.
  const p = proponerMapeo(['NOMBRE', 'TELEFONO', 'MOVIL', 'NIF', 'ETIQUETAS', 'DIRECCION', 'CIUDAD', 'CP', 'PROVINCIA', 'PAIS']);
  const campo = (columna) => p.find((c) => c.columna === columna).campo;
  assert.equal(campo('TELEFONO'), 'phone');
  assert.equal(campo('MOVIL'), 'mobile', '🔴 MOVIL cayendo en phone perdería el teléfono fijo de esa fila');
  assert.equal(campo('NIF'), 'taxId');
  assert.equal(campo('ETIQUETAS'), 'tags');
  assert.equal(campo('DIRECCION'), 'billingAddress');
  assert.equal(campo('CIUDAD'), 'billingCity');
  assert.equal(campo('CP'), 'billingPostalCode');
  assert.equal(campo('PROVINCIA'), 'billingProvince');
  assert.equal(campo('PAIS'), 'billingCountry');
});

test('② la confianza se distingue: exacta vs sinónimo', () => {
  assert.equal(proponerMapeo(['name'])[0].confianza, 'exacta');
  assert.equal(proponerMapeo(['NOMBRE'])[0].confianza, 'sinonimo');
});

test('② normalizarCabecera quita tildes, mayúsculas y separadores', () => {
  assert.equal(normalizarCabecera(' E-Mail '), 'email');
  assert.equal(normalizarCabecera('TELÉFONO'), 'telefono');
});

// ═════════════════════════════════════════════════════════════════════════════
// ③ NADA EN SILENCIO
// ═════════════════════════════════════════════════════════════════════════════

const CSV = 'nombre;telefono;email\r\nAna;34000000001;ana@x.es\r\n;34000000002;sin@nombre.es\r\nLuis;34000000003;luis@x.es';

test('③ una fila sin nombre se RECHAZA y se dice, con su número de fila', () => {
  // El defecto viejo: `if (!name) { errors++; continue; }` — se contaba y no se listaba.
  return importarClientes(7, CSV, MAPEO, clienteFalso()).then((r) => {
    assert.equal(r.creados, 2);
    assert.equal(r.rechazos.length, 1);
    assert.equal(r.rechazos[0].motivo, 'Falta el nombre');
    // Fila 3 es la que ve el usuario en su hoja: +1 cabecera, +1 porque Excel empieza en 1.
    assert.equal(r.rechazos[0].fila, 3, '🔴 un número de fila que no cuadra con su Excel no sirve para corregir');
  });
});

test('③ los rechazos NO se capan a 10', async () => {
  // El importador viejo hacía `errorList.slice(0, 10)`: con 40 filas malas, el usuario veía 10
  // y no sabía cuáles eran las otras 30.
  const filas = Array.from({ length: 40 }, () => ';34000000004;x@y.z').join('\r\n');
  const r = await importarClientes(7, `nombre;telefono;email\r\n${filas}`, MAPEO, clienteFalso());
  assert.equal(r.rechazos.length, 40, '🔴 capar la lista es descartar en silencio con otro nombre');
});

test('③ las rechazadas se pueden DESCARGAR, con su motivo y en el formato que abrirá Excel', async () => {
  const r = await importarClientes(7, CSV, MAPEO, clienteFalso());
  const csv = csvDeRechazos(r);
  assert.ok(csv.startsWith('﻿'), '🔴 sin BOM, Excel abre el fichero de corrección con mojibake');
  assert.match(csv, /MOTIVO/, 'la cabecera original + el motivo');
  assert.match(csv, /Falta el nombre/);
  assert.match(csv, /34000000002/, '🔴 la fila original tiene que venir entera para poder corregirla');
});

test('③ 🔴 NUNCA cero filas en SILENCIO: sin columna de nombre, LANZA', async () => {
  // El defecto medido: `if (iName < 0) return []` en el navegador devolvía cero filas y el
  // usuario leía «0 importados» sin saber por qué. La pantalla de mapeo lo hace improbable
  // —ya no adivina, propone— pero este test lo PROHÍBE explícitamente, porque el camino viejo
  // puede volver por otro sitio.
  await assert.rejects(
    () => importarClientes(7, CSV, { phone: 1 }, clienteFalso()),
    /sin_columna_nombre/,
    '🔴 se ha vuelto a devolver «nada» sin decir por qué',
  );
});

test('③ un duplicado se OMITE, y omitido no es lo mismo que rechazado', async () => {
  const cl = clienteFalso({ existentes: [{ merchantId: 7, phone: '34000000001', email: null }] });
  const r = await importarClientes(7, CSV, MAPEO, cl);
  assert.equal(r.omitidos, 1, 'ya existía: no es un error del usuario');
  assert.equal(r.creados, 1);
  assert.equal(r.rechazos.length, 1, 'y el de sin nombre sigue siendo rechazo');
});

// ═════════════════════════════════════════════════════════════════════════════
// ④ SCRUM-1046 · NIF, MÓVIL, ETIQUETAS Y DIRECCIÓN, importados
// ═════════════════════════════════════════════════════════════════════════════

const MAPEO_COMPLETO = {
  name: 0, phone: 1, mobile: 2, email: 3, taxId: 4, tags: 5,
  billingAddress: 6, billingCity: 7, billingPostalCode: 8, billingProvince: 9, billingCountry: 10,
};
const CABECERA_COMPLETA = 'nombre;telefono;movil;email;nif;etiquetas;direccion;ciudad;cp;provincia;pais';

test('④ una fila completa importa los siete campos nuevos', async () => {
  // Las etiquetas van en UNA celda CSV, entrecomillada porque lleva el mismo `;` que separa
  // columnas — dentro se parten con `;` OTRA VEZ, ya en memoria (ver el fichero fuente).
  const fila = 'Ana;34000000001;34600000001;ana@x.es;33576428Q;"moroso;administrador";Calle Mayor 1;Madrid;28001;Madrid;ES';
  const cl = clienteFalso();
  const r = await importarClientes(7, `${CABECERA_COMPLETA}\r\n${fila}`, MAPEO_COMPLETO, cl);
  assert.equal(r.creados, 1);
  const c = cl.creados[0];
  assert.equal(c.taxId, '33576428Q');
  assert.deepEqual(c.tags, ['moroso', 'administrador']);
  assert.equal(c.billingAddress, 'Calle Mayor 1');
  assert.equal(c.billingCity, 'Madrid');
  assert.equal(c.billingPostalCode, '28001');
  assert.equal(c.billingProvince, 'Madrid');
  assert.equal(c.billingCountry, 'ES');
  assert.equal(c.mobile, '34600000001');
});

test('④ un NIF mal formado se RECHAZA con su motivo, sin tumbar las demás filas', async () => {
  const filas = ['Ana;;;;12345678A;;;;;;', 'Luis;;;;33576428Q;;;;;;'].join('\r\n'); // 12345678 pide letra Z, no A
  const r = await importarClientes(7, `${CABECERA_COMPLETA}\r\n${filas}`, MAPEO_COMPLETO, clienteFalso());
  assert.equal(r.rechazos.length, 1);
  assert.match(r.rechazos[0].motivo, /NIF/);
  assert.equal(r.creados, 1, '🔴 un NIF roto no puede tumbar la fila de al lado');
});

test('④ un NIF vacío sigue siendo válido — validar no es obligar', async () => {
  const r = await importarClientes(7, `${CABECERA_COMPLETA}\r\nAna;;;;;;;;;;`, MAPEO_COMPLETO, clienteFalso());
  assert.equal(r.creados, 1);
  assert.equal(r.rechazos.length, 0);
});

test('④ un país que no es el código ISO de 2 letras se RECHAZA en vez de adivinarse', async () => {
  const r = await importarClientes(7, `${CABECERA_COMPLETA}\r\nAna;;;;;;;;;;España`, MAPEO_COMPLETO, clienteFalso());
  assert.equal(r.rechazos.length, 1);
  assert.match(r.rechazos[0].motivo, /País/);
  assert.equal(r.creados, 0, '🔴 truncar "España" a "ES" sería inventar un dato que nadie escribió así');
});

test('④ las etiquetas respetan el límite de 20 por cliente (`tagsDelCliente.ts`)', async () => {
  const veinticinco = Array.from({ length: 25 }, (_, i) => `tag${i}`).join(';');
  const cl = clienteFalso();
  const r = await importarClientes(7, `${CABECERA_COMPLETA}\r\nAna;;;;;"${veinticinco}";;;;;`, MAPEO_COMPLETO, cl);
  assert.equal(r.creados, 1);
  assert.equal(r.rechazos.length, 0, '🔴 el tope se aplica recortando, no rechazando la fila entera');
  assert.equal(cl.creados[0].tags.length, 20, '🔴 más de 20 etiquetas no es un tope si se guardan todas');
});

test('④ un NIF repetido DENTRO del mismo archivo se omite, no se duplica en silencio', async () => {
  const filas = ['Ana;;;;33576428Q;;;;;;', 'Ana Dos;;;;33576428Q;;;;;;'].join('\r\n');
  const r = await importarClientes(7, `${CABECERA_COMPLETA}\r\n${filas}`, MAPEO_COMPLETO, clienteFalso());
  assert.equal(r.creados, 1);
  assert.equal(r.omitidos, 1, '🔴 el segundo NIF igual crearía un cliente duplicado');
});

test('④ un NIF que YA EXISTE en la base con otra CAPITALIZACIÓN se omite', async () => {
  const cl = clienteFalso({ existentes: [{ merchantId: 7, taxId: 'A58818501' }] });
  const r = await importarClientes(7, `${CABECERA_COMPLETA}\r\nAna;;;;a58818501;;;;;;`, MAPEO_COMPLETO, cl);
  assert.equal(r.omitidos, 1, '🔴 minúsculas/mayúsculas distintas no pueden esconder el mismo NIF');
  assert.equal(r.creados, 0);
});

test('④ un móvil que ya existe como móvil de otro cliente se omite (dedup propio, no comparte con teléfono)', async () => {
  const cl = clienteFalso({ existentes: [{ merchantId: 7, mobile: '34600000009' }] });
  const r = await importarClientes(7, `${CABECERA_COMPLETA}\r\nAna;;34600000009;;;;;;;;`, MAPEO_COMPLETO, cl);
  assert.equal(r.omitidos, 1);
});

// ═════════════════════════════════════════════════════════════════════════════
// TENENCIA — un import no puede meter clientes en el merchant de otro
// ═════════════════════════════════════════════════════════════════════════════

test('TENENCIA · todo cliente se crea con el merchantId que se pasa, y el dedup va acotado', async () => {
  const cl = clienteFalso({ existentes: [{ merchantId: 999, phone: '34000000001', email: null }] });
  const r = await importarClientes(7, CSV, MAPEO, cl);

  assert.ok(cl.creados.every((c) => c.merchantId === 7),
    '🔴 un cliente se crearía en el merchant equivocado');
  // El duplicado es de OTRO merchant: no debe omitirse por él.
  assert.equal(r.omitidos, 0, '🔴 el dedup miró fuera del merchant: filtraría datos de otro');
  assert.equal(r.creados, 2);
});

// tests/scrum664-el-compilador-como-censo.test.mjs — SCRUM-664
//
// Sin gate: compila fuentes en memoria. Ni BD, ni red, ni servidor.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL AGUJERO QUE TAPA, Y CUÁL DE LOS DOS ES
//
// El cortafuegos de SCRUM-646 vigila que `defaultVat` no vuelva a escribirse en la base, y lo
// hace por AST. Tiene DOS agujeros declarados, y este ticket cierra **UNO SOLO**:
//
//   ① vigila el NOMBRE, no el VALOR: un `0.21` escrito a mano pasa por delante.
//      🔴 **NO SE CUBRE AQUÍ.** Se midió (ver `docs/master/SCRUM-664.md`) y la decisión de si
//      se construye es del fundador. Este fichero NO lo mira, y decirlo es la mitad del trabajo:
//      un guard que promete más de lo que hace es peor que uno que promete poco.
//
//   ② no ve una escritura LIGADA en otra función.
//      ✅ **ES LO QUE CUBRE ESTE FICHERO.**
//
// ── POR QUÉ EL ② Y POR QUÉ ASÍ ───────────────────────────────────────────────────────────
// Un censo por AST de las escrituras de IVA devolvió UN sitio y había TRES. El tercero,
// `tax: vat` dentro de un `.map`, no estaba sintácticamente dentro de la llamada a Prisma. Lo
// cazó el COMPILADOR: al retirar la variable, `tsc` dijo «Cannot find name 'vat'».
//
// Dos instrumentos que fallan en el mismo sentido se confirman falsamente; dos que fallan por
// motivos distintos se corrigen. El AST mira POSICIÓN, el compilador resuelve LIGADURAS.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  dependenciasDe, escriturasEnLlamadaPrisma, CODIGOS_NOMBRE_AUSENTE,
} from './_dependencias-por-compilacion.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const RUTA_ALTA = path.join(RAIZ, 'src/modules/products/app/routes/products.routes.ts');
const CAMPOS_DE_IVA = ['vat', 'tax'];

/**
 * El corpus reproduce LA FORMA HISTÓRICA, las tres escrituras incluidas, y la tercera vive donde
 * vivía: dentro de un `.map` cuyo resultado se guarda en un `const` y SÓLO DESPUÉS entra en la
 * llamada a Prisma. Si se escribiera dentro de la llamada, el censo por AST la vería y este
 * fichero estaría midiendo un caso que no es el que se escapó.
 */
const CORPUS_TRES_SITIOS = `
import { getLocale } from './locales';
declare const prisma: any;
declare const merchant: any;
declare const file: any;
declare const priceOf: any;

export async function cargarCatalogo() {
  const vat = getLocale(merchant.country).defaultVat;

  await prisma.product.create({ data: { name: 'uno', vat } });

  await prisma.product.create({ data: { name: 'dos', vat: vat } });

  for (const tpl of file.plantillas) {
    const lines = tpl.lines.map((l: any) => ({
      concept: l.concept,
      price: priceOf.get(l.priceFrom) ?? 0,
      tax: vat,
    }));
    await prisma.quoteTemplate.create({ data: { lines } });
  }
}
`;

// ── EL CASO QUE DECIDE ──────────────────────────────────────────────────────────────────

test('SCRUM-664 · 🔴 EL CASO QUE DECIDE: el compilador ve las TRES, el AST sólo UNA', () => {
  const porCompilacion = dependenciasDe(CORPUS_TRES_SITIOS, 'vat');
  assert.equal(porCompilacion.ciego, null, `🔴 el instrumento se declaró ciego: ${porCompilacion.ciego}`);
  assert.equal(porCompilacion.declarado, true, '🔴 no encontró la declaración que hay que retirar.');

  const porAst = escriturasEnLlamadaPrisma(CORPUS_TRES_SITIOS, CAMPOS_DE_IVA);

  assert.equal(porCompilacion.usos.length, 3,
    '🔴 el compilador tiene que ver las TRES escrituras. Ve ' + porCompilacion.usos.length + ':\n    '
    + porCompilacion.usos.map((u) => `línea ${u.linea} (código ${u.codigo})`).join('\n    '));

  assert.equal(porAst.length, 2,
    '🔴 este censo por AST tiene que ver DOS —las que están dentro de la llamada— y ve ' +
    porAst.length + '. Si viera tres, el corpus ya no reproduce el defecto y esta comparación\n' +
    '   no prueba nada; si viera una, el censo cambió y hay que volver a medir.');

  // Lo que decide: la del `.map` está en un instrumento y NO en el otro.
  const lineaDelMap = CORPUS_TRES_SITIOS.split('\n').findIndex((l) => l.includes('tax: vat')) + 1;
  assert.ok(lineaDelMap > 0, '🔴 SUELO: el corpus ya no tiene la escritura del `.map`.');
  assert.ok(porCompilacion.usos.some((u) => u.linea === lineaDelMap),
    `🔴 el compilador NO ve la escritura del \`.map\` (línea ${lineaDelMap}). Es la única que\n` +
    '   justifica este ticket: sin ella, el censo por AST bastaba.');
  assert.ok(!porAst.some((e) => e.linea === lineaDelMap),
    `🔴 el censo por AST SÍ ve la del \`.map\` (línea ${lineaDelMap}). Entonces el corpus no\n` +
    '   reproduce el defecto medido, y toda la comparación de arriba es un adorno.');
});

test('SCRUM-664 · 🔴 el rojo viene de LA COMPILACIÓN, y nombra el símbolo que faltó', () => {
  const r = dependenciasDe(CORPUS_TRES_SITIOS, 'vat');
  assert.ok(r.usos.length > 0, '🔴 SUELO: sin usos no se puede comprobar de dónde vienen.');
  for (const u of r.usos) {
    assert.ok(CODIGOS_NOMBRE_AUSENTE.includes(u.codigo),
      `🔴 el uso de la línea ${u.linea} llega con el código ${u.codigo}, que no es de «ese nombre\n` +
      '   no existe». El hallazgo tiene que venir de la resolución de nombres, no de otro error.');
    assert.ok(u.texto.includes("'vat'"),
      `🔴 el mensaje de la línea ${u.linea} no nombra el símbolo que faltó: «${u.texto}».`);
  }
});

test('SCRUM-664 · 🔴 EL ATAJO `{ vat }` también se ve, y llega por el OTRO código', () => {
  // Medido: el compilador NO usa un solo código. El atajo da 18004 y la propiedad normal 2304.
  // Un filtro que sólo mirara 2304 habría contado dos de tres — el mismo punto ciego que este
  // ticket denuncia, dentro del instrumento que viene a cerrarlo.
  const r = dependenciasDe(CORPUS_TRES_SITIOS, 'vat');
  const lineaAtajo = CORPUS_TRES_SITIOS.split('\n').findIndex((l) => l.includes("'uno', vat }")) + 1;
  assert.ok(lineaAtajo > 0, '🔴 SUELO: el corpus ya no tiene la forma de atajo.');
  const atajo = r.usos.find((u) => u.linea === lineaAtajo);
  assert.ok(atajo, `🔴 el atajo de la línea ${lineaAtajo} no se está viendo.`);
  assert.equal(atajo.codigo, 18004,
    `🔴 el atajo llega con el código ${atajo.codigo} y se midió que llega con 18004. Si el\n` +
    '   compilador cambió de código, el filtro hay que volver a medirlo, no adivinarlo.');
  assert.ok(r.usos.some((u) => u.codigo === 2304), '🔴 y las normales tienen que llegar con 2304.');
});

test('SCRUM-664 · los códigos de «ese nombre no existe» siguen siendo DOS', () => {
  // Trinquete sobre una lista escrita a mano: si alguien la recorta a uno, el atajo deja de verse
  // y el instrumento adelgaza en silencio.
  assert.deepEqual([...CODIGOS_NOMBRE_AUSENTE].sort((a, b) => a - b), [2304, 18004],
    '🔴 la lista de códigos ha cambiado. Se midió que son DOS: 2304 para `vat: vat` y 18004 para\n' +
    '   el atajo `{ vat }`. Quitar uno deja ciego al instrumento para esa forma.');
});

// ── CONTROLES NEGATIVOS ─────────────────────────────────────────────────────────────────

test('SCRUM-664 · CONTROL NEGATIVO: retirar un símbolo AJENO no acusa a `vat`', () => {
  const r = dependenciasDe(CORPUS_TRES_SITIOS, 'priceOf');
  assert.equal(r.ciego, null, `🔴 se declaró ciego con un símbolo que sí está: ${r.ciego}`);
  for (const u of r.usos) {
    assert.ok(u.texto.includes("'priceOf'"),
      `🔴 al retirar \`priceOf\` aparece un hallazgo que habla de otra cosa: «${u.texto}». El\n` +
      '   instrumento estaría atribuyendo a una retirada errores que ya estaban.');
  }
});

test('SCRUM-664 · CONTROL NEGATIVO: un símbolo declarado y NO usado da CERO', () => {
  // Sin esto, un instrumento que devolviera siempre «sí, hay dependencias» pasaría los tests de
  // arriba enteros: hay que probar que sabe decir que no.
  const sinUsos = `
declare const prisma: any;
export async function f() {
  const vat = 0.21;
  await prisma.product.create({ data: { name: 'uno' } });
}
`;
  const r = dependenciasDe(sinUsos, 'vat');
  assert.equal(r.ciego, null, `🔴 ciego: ${r.ciego}`);
  assert.equal(r.declarado, true, '🔴 la declaración está ahí y no la ve.');
  assert.deepEqual(r.usos, [], '🔴 nadie usa `vat` y el instrumento dice que sí.');
});

test('SCRUM-664 · 🔴 SUELO: si la fuente YA se queja de ese nombre, se declara CIEGO', () => {
  // «Cero dependencias» y «no supe mirar» son el mismo cero con significados opuestos.
  const yaRota = `
declare const prisma: any;
export async function f() {
  await prisma.product.create({ data: { vat: vat } });
}
`;
  const r = dependenciasDe(yaRota, 'vat');
  assert.ok(r.ciego, '🔴 la fuente ya echaba en falta `vat` ANTES de tocar nada y no se ha dicho.');
  assert.match(r.ciego, /SIN TOCAR/, '🔴 el motivo no explica qué pasó.');
  assert.deepEqual(r.usos, [], '🔴 con la respuesta en duda no se devuelven usos.');
});

test('SCRUM-664 · 🔴 SUELO: sin declaración que retirar, se dice — no se contesta CERO', () => {
  const r = dependenciasDe('export const a = 1;\n', 'vat');
  assert.ok(r.ciego, '🔴 no hay `vat` que retirar y el instrumento contesta como si hubiera mirado.');
  assert.match(r.ciego, /no tiene por dónde empezar/,
    '🔴 el motivo tiene que separar «no hay dependencias» de «no tengo por dónde empezar».');
});

// ── SOBRE EL FICHERO REAL, VIVO ─────────────────────────────────────────────────────────

test('SCRUM-664 · el alta del catálogo NO tiene hoy ninguna ligadura de IVA', () => {
  const fuente = fs.readFileSync(RUTA_ALTA, 'utf8');
  const r = dependenciasDe(fuente, 'vat');
  assert.equal(r.declarado, false,
    '🔴 HA VUELTO UNA VARIABLE `vat` AL ALTA DEL CATÁLOGO. Eso es justo lo que SCRUM-646 retiró:\n' +
    '   un tipo impositivo grabado en cada producto que nace, sin que el profesional lo elija.\n' +
    '   Usos que dependen de ella:\n    ' + r.usos.map((u) => `línea ${u.linea}`).join('\n    '));
  assert.match(r.ciego || '', /no hay ninguna declaración/,
    '🔴 y el motivo tiene que ser ése, no otro: si el instrumento se declara ciego por haber\n' +
    '   encontrado errores previos, esta comprobación no ha mirado nada.');
});

test('SCRUM-664 · 🔴 VIVO: si alguien la reintroduce EN EL `.map` del fichero real, se caza', () => {
  // Esto es lo que separa un instrumento probado en un corpus de un guard que sirve. La mutación
  // es EN MEMORIA sobre el fichero de verdad, y reproduce la forma exacta que se escapó.
  const fuente = fs.readFileSync(RUTA_ALTA, 'utf8');

  const ANCLA_DECL = "    const country = (merchant.country || 'ES').toUpperCase();";
  const ANCLA_MAP = '              price: priceOf.get(l.priceFrom) ?? 0,';
  assert.ok(fuente.includes(ANCLA_DECL),
    '🔴 SUELO: no encuentro dónde inyectar la declaración en `products.routes.ts`. El fichero se\n' +
    '   movió y esta prueba dejaría de probar nada: hay que reanclarla, no borrarla.');
  assert.ok(fuente.includes(ANCLA_MAP),
    '🔴 SUELO: no encuentro el `.map` de las plantillas. Es EL sitio que este ticket cubre.');

  const mutado = fuente
    .replace(ANCLA_DECL, ANCLA_DECL + '\n    const vat = getLocale(merchant.country).defaultVat;')
    .replace(ANCLA_MAP, ANCLA_MAP + '\n              tax: vat,');
  assert.notEqual(mutado, fuente, '🔴 la mutación no ha cambiado nada.');

  const r = dependenciasDe(mutado, 'vat');
  assert.equal(r.ciego, null, `🔴 el instrumento se declaró ciego sobre el fichero real: ${r.ciego}`);
  assert.ok(r.usos.length >= 1,
    '🔴 se ha reintroducido `tax: vat` DENTRO DEL `.map` del fichero real y el instrumento no lo\n' +
    '   ve. Es exactamente el caso que el censo por AST no alcanzaba: si esto no cae, el ticket\n' +
    '   no ha cerrado nada.');

  // Y que el uso cazado sea el del `.map`, no otro cualquiera.
  const lineaMap = mutado.split('\n').findIndex((l) => l.trim() === 'tax: vat,') + 1;
  assert.ok(r.usos.some((u) => u.linea === lineaMap),
    `🔴 el instrumento ve usos pero NINGUNO es el del \`.map\` (línea ${lineaMap}).`);

  // CONTROL: el censo por AST sobre ese mismo mutado NO lo ve. Es la comparación, sobre el
  // fichero real y no sólo sobre el corpus.
  const porAst = escriturasEnLlamadaPrisma(mutado, CAMPOS_DE_IVA);
  assert.ok(!porAst.some((e) => e.linea === lineaMap),
    '🔴 el censo por AST SÍ ve la escritura del `.map` en el fichero real. Entonces no hacía\n' +
    '   falta este ticket, y hay que volver a medir por qué en SCRUM-646 no la vio.');
});

test('SCRUM-664 · CONTROL NEGATIVO sobre el fichero real: una mutación AJENA no lo acusa', () => {
  const fuente = fs.readFileSync(RUTA_ALTA, 'utf8');
  const ANCLA_MAP = '              price: priceOf.get(l.priceFrom) ?? 0,';
  assert.ok(fuente.includes(ANCLA_MAP), '🔴 SUELO: ancla perdida.');
  // Se añade una propiedad que NO depende de ninguna ligadura de IVA.
  const mutado = fuente.replace(ANCLA_MAP, ANCLA_MAP + "\n              nota: 'x',");
  const r = dependenciasDe(mutado, 'vat');
  assert.equal(r.declarado, false,
    '🔴 una propiedad ajena está haciendo creer que hay una ligadura de IVA.');
  assert.deepEqual(r.usos, [], '🔴 y no puede devolver usos.');
});

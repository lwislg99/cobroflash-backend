// tests/scrum294a-recargo-en-cliente.test.mjs — SCRUM-294-a (A3)
//
// EL RECARGO DE EQUIVALENCIA ES UNA PROPIEDAD DEL CLIENTE — Y NO TOCA NINGÚN TOTAL.
//
// ── LA TESIS ───────────────────────────────────────────────────────────────────────────────
// Un cliente en recargo lo está SIEMPRE. Preguntarlo en cada factura es pedirle al profesional que
// recuerde el régimen fiscal de su cliente, así que el dato vive en su ficha.
//
// ── LOS TRES ESTADOS, Y POR QUÉ NO HAY `@default(false)` ──────────────────────────────────
// `Boolean?` sin default:  NULL = no consta · false = declara que NO · true = declara que SÍ.
// Un `@default(false)` habría convertido a **todos los clientes de hoy** en «declarado que no lo
// lleva», y eso no lo ha dicho nadie. El tipo da los tres estados; no hay que inventar ninguno.
//
// ── 🔴 EL FALLO QUE YA MORDIÓ, Y VIVE AQUÍ (SCRUM-271) ────────────────────────────────────
// **Una casilla que se lee mal no puede caer a `false` en silencio.** `false` es un valor LEGÍTIMO
// —«declara que no»—, así que es el peor sitio posible donde degradar: nadie notaría el fallo. Por
// eso el campo es un SELECT de tres opciones y no una casilla, y por eso «no consta» viaja como
// `null` explícito.
//
// ── 🛑 LO QUE ESTE TICKET NO HACE ─────────────────────────────────────────────────────────
// **No cablea nada al total.** El recargo cambia lo que el cliente paga —base + cuota + recargo— y
// por tanto el número que se SELLA: camino de emisión, regla 38. El cálculo existe y espera en
// `invoicing/domain/recargoEquivalencia.ts`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { soloEjecutable } from './_guard-texto.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const leer = (p) => {
  try {
    return fs.readFileSync(path.join(RAIZ, p), 'utf8');
  } catch (e) {
    assert.fail(`🔴 no se pudo leer ${p} (${e && e.code ? e.code : e}). «Está» y «no supe mirar» son el mismo verde.`);
  }
};

const SCHEMA = 'prisma/schema.prisma';
const VISTA = 'public/dashboard/js/customersView.js';

// ── 0 · SUELO ─────────────────────────────────────────────────────────────────────────────

test('SCRUM-294-a · SUELO: se leen el schema y la ficha, y tienen contenido', () => {
  assert.ok(leer(SCHEMA).length > 5000, '🔴 el schema no es el fichero que se cree');
  assert.ok(leer(VISTA).length > 5000, '🔴 la ficha de cliente no es el fichero que se cree');
});

// ── 1 · CONTROL NEGATIVO, PRIMERO ─────────────────────────────────────────────────────────

test('SCRUM-294-a · 🔴 CONTROL NEGATIVO: el recargo NO toca el total ni el sellado', () => {
  // Hoy es trivial de sostener porque no hay cable — y por eso se escribe HOY: el día que alguien
  // cablee, este test ya existe y le obligará a decidirlo a propósito, no de refilón.
  const emision = [
    'src/modules/invoicing/domain/invoiceLines.service.ts',
    'src/modules/invoicing/domain/finalInvoice.service.ts',
    'src/lib/invoicing.ts',
  ];
  for (const f of emision) {
    const src = soloEjecutable(leer(f));
    assert.ok(!/recargo/i.test(src),
      `🔴 ${f} MENCIONA EL RECARGO.\n\n`
      + '  Este ticket entrega el DATO del cliente, no el cable. El recargo cambia lo que el cliente\n'
      + '  paga —base + cuota + recargo— y por tanto el número que se SELLA en la factura: eso es\n'
      + '  camino de emisión (regla 38) y necesita su GO, su control negativo byte a byte y el\n'
      + '  desglose del XML. Si estás cableándolo, para y ábrele su ticket.');
  }

  // Y el motor sigue esperando sin llamadores: si alguien lo enchufa, se entera este test.
  const motor = 'src/modules/invoicing/domain/recargoEquivalencia.ts';
  assert.ok(fs.existsSync(path.join(RAIZ, motor)), `🔴 ha desaparecido ${motor}`);
});

// ── 2 · LOS TRES ESTADOS NO COLAPSAN ──────────────────────────────────────────────────────

test('SCRUM-294-a · el schema declara `Boolean?` SIN default', () => {
  // 🔴 SIN COMENTARIOS, y lo aprendí aquí mismo: la primera versión cogía la línea del COMENTARIO
  // que explica dónde vive el motor (`invoicing/domain/recargoEquivalencia.ts`) y fallaba contra un
  // schema correcto. Es la trampa de la casa otra vez —el guard cazándose en su propia
  // explicación—, esta vez en un comentario de Prisma. Se filtran los comentarios ANTES de buscar.
  const modelo = leer(SCHEMA).slice(leer(SCHEMA).indexOf('model Customer'));
  const linea = modelo.split(/\r?\n/)
    .filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l))
    .find((l) => l.includes('recargoEquivalencia'));
  assert.ok(linea, '🔴 `recargoEquivalencia` no está en el modelo `Customer`');
  assert.match(linea, /Boolean\?/,
    '🔴 el campo ha dejado de ser opcional: sin `?` no existe «no consta» y todos los clientes '
    + 'quedan declarados en un régimen que nadie ha declarado.');
  assert.ok(!/@default/.test(linea),
    '🔴 LE HAN PUESTO UN `@default`.\n\n'
    + '  Un `@default(false)` convierte a TODOS los clientes existentes en «declarado que NO lleva\n'
    + '  recargo», y eso no lo ha dicho nadie. NULL = no consta es la verdad de lo que hay hoy.');
  assert.match(linea, /@map\("recargo_equivalencia"\)/,
    '🔴 el nombre físico no es el de la columna que YA existe en producción y staging.');
});

test('SCRUM-294-a · la validación admite los TRES estados y ninguno más', () => {
  const zod = soloEjecutable(leer('src/core/validation/schemas.ts'));
  assert.match(zod, /recargoEquivalencia:\s*z\.boolean\(\)\.nullable\(\)\.optional\(\)/,
    '🔴 la validación ya no admite los tres estados. `nullable().optional()` es lo que distingue '
    + '«no se toca» (ausente) de «no consta» (null) de «declarado» (true/false).');
});

// 🔴 SCRUM-1783b (21-nov-2026) · ESTE CASO SE REANCLÓ, con autorización del fundador (SCRUM-1783
// c.22267, «1-Sí»): el selector salió de la ficha (c.22264). Antes exigía que la ficha leyera y
// escribiera los TRES estados sin degradar a `false`; ahora exige que la ficha NO lea ni escriba el
// recargo. La lección de SCRUM-271 no se pierde, cambia de forma: el peor fallo ya no es mandar
// `false` en vez de `null`, sino mandar CUALQUIER valor — sin control en pantalla, un `null` en el
// payload borraría el dato guardado en cada guardado (medido por jv-j2dm, c.22266).
test('SCRUM-294-a · 🔴 la ficha ya NO lee ni envía el recargo (SCRUM-1783b): no puede borrar el dato', () => {
  const vista = soloEjecutable(leer(VISTA));

  // Control positivo: la vista que se lee es la del modal (el payload de sus vecinos sigue ahí).
  assert.match(vista, /tipoDestinatario: fieldTipoDestinatario\.value \|\| null/,
    '🔴 CIEGO: no encuentro el payload del modal en la vista; «no lo envía» sería cierto sobre nada.');

  // Al LEER: la ficha ya no rellena ningún control con el recargo.
  assert.ok(!/editingCustomer\.recargoEquivalencia/.test(vista),
    '🔴 la ficha vuelve a LEER el recargo del cliente, pero ya no tiene control que lo enseñe '
    + '(SCRUM-1783 c.22264).');

  // Al ESCRIBIR: la clave no viaja. Ausente = Zod `.partial()` no la produce y Prisma no la toca.
  assert.ok(!/recargoEquivalencia\s*:/.test(vista),
    '🔴 EL PAYLOAD VUELVE A LLEVAR `recargoEquivalencia`.\n\n'
    + '  La ficha ya no muestra el recargo, así que cualquier valor que mande no lo ha escrito el\n'
    + '  profesional: con `null`, cada guardado BORRARÍA el dato guardado (SCRUM-1783 c.22266).');

  // Y no ha vuelto como casilla por otro lado.
  assert.ok(!/fieldRecargo/.test(vista),
    '🔴 ha vuelto un control del recargo (`fieldRecargo`) a la ficha.');
});

// ── 3 · SE LEE Y SE ESCRIBE DE VERDAD ─────────────────────────────────────────────────────

test('SCRUM-294-a · el dato se lee en la ficha (si no, el campo aparecería vacío siempre)', () => {
  const svc = soloEjecutable(leer('src/modules/system/customerAdmin.ts'));
  assert.match(svc, /recargoEquivalencia:\s*true/,
    '🔴 `recargoEquivalencia` no está en el `select` de la ficha: se podría guardar y **nunca se '
    + 'volvería a ver**, que es la forma más silenciosa de perder un dato.');
});

// ── 4 · MICROCOPY: MARCADOR, NO TEXTO ─────────────────────────────────────────────────────

test('SCRUM-294-a · el rótulo es un MARCADOR sin aprobar, no microcopy inventada', () => {
  const vista = leer(VISTA);
  // 🔴 SE COMPRUEBA EL RÓTULO, NO «que quede algún marcador en el bloque». La primera versión
  // buscaba el marcador en cualquier parte, así que alguien podía escribir el texto del rótulo y el
  // guard seguía verde con los marcadores de las TRES opciones. Un guard que se conforma con que
  // quede uno no protege a los demás.
  // 17-ago-2026 · APROBADOS los cuatro (rótulo + tres opciones). El guard NO se relaja: seguía
  // exigiendo el marcador y ahora exige el TEXTO APROBADO, así que un renombre sigue cayendo. Y se
  // mantiene su lección original —se comprueba el RÓTULO, no «que quede algún marcador»—: por eso
  // debajo se cuentan las CUATRO ranuras una a una y no basta con que acierte una.
  // 🔴 SCRUM-1783b (21-nov-2026) · REANCLADO con autorización del fundador (SCRUM-1783 c.22267):
  // el campo salió de la ficha (c.22264), así que ahora se exige que NINGUNO de los cuatro textos
  // aprobados quede en la vista. Si el selector vuelve, vuelve con decisión nueva, no de refilón.
  const ejecutable = soloEjecutable(vista);
  for (const t of ['Recargo de equivalencia', 'No consta', 'Sí, está en recargo', 'No está en recargo']) {
    assert.ok(!ejecutable.includes('"' + t + '"') && !ejecutable.includes('>' + t + '<'),
      `🔴 «${t}» ha vuelto a la ficha del cliente: el selector del recargo se quitó (SCRUM-1783 c.22264).`);
  }
  // Control positivo del mismo instrumento: un texto que SÍ sigue en la ficha se ve con él.
  assert.ok(ejecutable.includes('>Sin clasificar<'),
    '🔴 CIEGO: el instrumento no ve «>Sin clasificar<», que sigue en la ficha; «no está» no vale nada.');
  // Lo que había aquí debajo (cuenta de marcadores y «el campo no aconseja») medía el BLOQUE del
  // selector. Sin selector no hay bloque, y medirlo sobre una cadena vacía sería una tautología con
  // forma de prueba (A3), así que se quitó en SCRUM-1783b en vez de dejarlo verde sobre nada. Si el
  // campo vuelve, vuelve con decisión nueva y esas comprobaciones vuelven con él.
});

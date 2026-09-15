// tests/scrum844c-el-xml-que-se-remite.test.mjs — SCRUM-844 · puesto 3
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LO QUE EL XML LE DICE A HACIENDA: QUIÉN EMITE, QUIÉN LO FABRICÓ Y QUÉ ANULACIONES ENTRAN.
//
// `buildVerifactuRegistrosXml` es el constructor del registro de facturación que sale hacia la
// AEAT — por el endpoint suelto y dentro de `datos.zip`, el MISMO texto. Diez ficheros de test lo
// llaman ya, ninguno gateado, y aun así SCRUM-840 midió aquí ocho puntos de lógica que se rompen
// sin que caiga nadie. Que un test LLEGUE a una función no dice que la esté mirando.
//
// ── EL ORDEN DE ESTE FICHERO ES EL DEL DAÑO ───────────────────────────────────────────────────
//
// 1. **El nombre del emisor** (`legalName || name`). Es el que firma el registro. Si cae a
//    `name`, YaQu declara ante Hacienda con el nombre COMERCIAL de un profesional cuya razón
//    social es otra — y lo declarado ya está dicho.
// 2. **Qué anulaciones entran en la cadena**. Una anulación a medias —huella sellada y sello
//    temporal todavía no— no es un eslabón: es una fila a mitad de escribir.
// 3. **El tope de registros por envío**. Pasado el tope, el fichero que sale no es válido para
//    la AEAT; fallar en claro es mejor que entregar algo que parece bueno.
// 4. **La guarda fail-closed del productor**, que es un caso aparte y se explica abajo.
//
// ⛔ Este fichero NO toca `src/`. Solo llama, lee y comprueba. Cada caso se probó EN ROJO
//    inyectando el punto exacto en `verifactu.service.ts`, recompilando, y restaurando el fuente
//    Y su `.js` de `dist/` byte a byte (`Buffer.compare === 0`).
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const DECLARACION = path.join(RAIZ, 'src', 'modules', 'invoicing', 'domain', 'verifactu.service.ts');

const { buildVerifactuRegistrosXml } =
  await import('../dist/modules/invoicing/domain/verifactu.service.js');
const { MAX_REGISTROS_POR_ENVIO } =
  await import('../dist/modules/fiscal/verifactu/registro.builder.js');
const { PRODUCTOR_VERIFACTU } =
  await import('../dist/modules/fiscal/verifactu/productor.js');

// ── El banco: el mismo patrón que `scrum145`, un doble que distingue las dos consultas ─────────
const MERCHANT = {
  id: 7, country: 'ES', taxId: 'B12345678',
  legalName: 'Reformas Integrales del Norte S.L.', name: 'Reformas Norte',
};

const mkInvoice = (over = {}) => ({
  number: '2026-CF-001', createdAt: new Date('2026-03-15T10:00:00Z'), total: '121.00', type: 'F1',
  lines: [{ concept: 'Reparación', qty: 1, price: 100, tax: 0.21 }],
  vfHash: 'A'.repeat(64), vfPrevHash: null, vfTimestamp: new Date('2026-03-15T10:00:05Z'),
  vfAnulHash: null, vfAnulTimestamp: null, vfAnulPrevHash: null,
  customer: { name: 'Cliente QA', taxId: 'A11111111' }, rectifies: null,
  ...over,
});

const fakePrisma = (invoices, merchant = MERCHANT) => ({
  merchant: { findUnique: async () => merchant },
  invoice: {
    findMany: async (args) => (args?.where?.vfHash ? invoices.filter((i) => i.vfHash) : invoices),
  },
});

const construir = (invoices, merchant) =>
  buildVerifactuRegistrosXml({ merchantId: 7, year: 2026 }, fakePrisma(invoices, merchant));

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// SUELO — sin esto, «el XML no dice X» y «no hubo XML» serían el mismo verde
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-844c · SUELO: el constructor produce un XML con un registro dentro', async () => {
  const { xml, count, excluidos } = await construir([mkInvoice()]);
  assert.equal(typeof buildVerifactuRegistrosXml, 'function',
    '🔴 `buildVerifactuRegistrosXml` ha dejado de exportarse: este fichero no mide nada');
  assert.equal(count, 1, `🔴 el banco no produjo registros (count=${count}): todo lo de abajo `
    + 'estaría comprobando la ausencia de un XML, no su contenido');
  assert.deepEqual(excluidos, [], '🔴 la factura del banco se está excluyendo; arregla el banco');
  assert.match(xml, /<sum1:RegistroAlta>/, '🔴 no hay RegistroAlta en el XML del banco');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 1 · 🔴 QUIÉN FIRMA EL REGISTRO — `legalName || name`
//
// Las DOS mitades del `||` son una declaración, y por eso hacen falta los dos casos: uno solo
// deja viva la mitad contraria. Con razón social puesta se declara ÉSA; sin ella, el nombre
// comercial es el único nombre que hay, y omitirlo dejaría el registro sin emisor.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-844c · 🔴 el emisor declarado es la RAZÓN SOCIAL, no el nombre comercial', async () => {
  const { xml } = await construir([mkInvoice()]);
  assert.ok(xml.includes(`<sum1:NombreRazon>${MERCHANT.legalName}</sum1:NombreRazon>`),
    `🔴 el XML no declara la razón social «${MERCHANT.legalName}». Con el nombre comercial `
    + 'encima, el registro dice que factura alguien que no es quien factura.');
  // Y no basta con que ESTÉ: el comercial no puede aparecer como emisor. `NombreRazon` lo usan
  // también el destinatario y el productor, así que se mira el emisor por su vecino del XSD.
  const bloqueEmisor = xml.slice(0, xml.indexOf('<sum1:IDFactura>'));
  assert.ok(!bloqueEmisor.includes(`>${MERCHANT.name}<`),
    `🔴 el nombre comercial «${MERCHANT.name}» aparece como emisor teniendo razón social`);
});

test('SCRUM-844c · ✅ sin razón social SÍ se declara el nombre comercial (no se queda vacío)', async () => {
  const sinRazonSocial = { ...MERCHANT, legalName: null };
  const { xml } = await construir([mkInvoice()], sinRazonSocial);
  assert.ok(xml.includes(`<sum1:NombreRazon>${MERCHANT.name}</sum1:NombreRazon>`),
    '🔴 sin `legalName` el emisor se queda sin nombre. Un registro sin emisor identificable no '
    + 'es un registro válido, y aquí el nombre comercial es el único nombre que hay.');
  assert.ok(!/<sum1:NombreRazon><\/sum1:NombreRazon>/.test(xml),
    '🔴 hay un NombreRazon VACÍO en el XML');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 2 · 🔴 QUÉ ANULACIONES ENTRAN EN LA CADENA — `vfAnulHash && vfAnulTimestamp`
//
// La cadena que resuelve el `RegistroAnterior` de cada anulación se construye filtrando las
// facturas que tienen las DOS cosas: la huella de anulación y el instante en que se selló. Una
// con huella pero sin sello es una anulación A MEDIAS, y el sello es justo lo que da su posición
// en la cadena: sin él no hay por dónde ordenarla.
//
// ⚠️ Y la trampa, medida: la mutación GRUESA de este punto (`.filter(() => true)`) tumba 35
// tests, así que mirándola parecería cubierto. Pero quitando UN SOLO operando —el que de verdad
// puede caerse en un refactor— no cae NADIE. Por eso los dos casos de abajo van por separado.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-844c · 🔴 una anulación A MEDIAS (huella sin sello) no entra en la cadena', async () => {
  // El caso real: se escribió `vfAnulHash` y el proceso murió antes de `vfAnulTimestamp`.
  const aMedias = mkInvoice({
    number: '2026-CF-002', vfHash: 'B'.repeat(64),
    vfAnulHash: 'C'.repeat(64), vfAnulTimestamp: null,
  });
  const { xml, count } = await construir([mkInvoice(), aMedias]);

  assert.equal(count, 2, '🔴 el banco no produjo los dos registros de alta');
  // Sin sello NO es un eslabón: ni entra en la cadena ni se emite su RegistroAnulacion.
  assert.ok(!xml.includes('C'.repeat(64)),
    '🔴 la huella de una anulación SIN SELLAR ha entrado en el XML. Sin `vfAnulTimestamp` no hay '
    + 'instante que declarar, y `FechaHoraHusoGenRegistro` saldría de una fecha que no existe.');
  assert.ok(!xml.includes('<sum1:RegistroAnulacion>'),
    '🔴 se ha emitido un RegistroAnulacion para una anulación a medio escribir');
});

test('SCRUM-844c · ✅ una anulación COMPLETA sí entra, y encadena por su huella persistida', async () => {
  const anulada = mkInvoice({
    number: '2026-CF-003', vfHash: 'D'.repeat(64),
    vfAnulHash: 'E'.repeat(64), vfAnulTimestamp: new Date('2026-04-01T09:00:00Z'),
    vfAnulPrevHash: 'A'.repeat(64), // encadena con el alta del banco
  });
  const { xml } = await construir([mkInvoice(), anulada]);

  assert.ok(xml.includes('<sum1:RegistroAnulacion>'),
    '🔴 una anulación CON huella y CON sello no ha producido su registro: este control positivo '
    + 'es lo que impide que el caso de arriba salga verde por no emitir nunca ninguna anulación');
  assert.ok(xml.includes('E'.repeat(64)), '🔴 falta la huella de la anulación en el XML');
  assert.ok(xml.includes('<sum1:RegistroAnterior>'),
    '🔴 la anulación no ha resuelto su RegistroAnterior desde la cadena');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 3 · 🔴 EL TOPE DE REGISTROS POR ENVÍO
//
// El XSD topa `RegistroFactura` por envío. Pasado el tope hay que trocear (lo hará la cola de
// remisión, S1-D); hasta entonces se falla en claro, porque un fichero inválido que PARECE bueno
// es peor que un error.
//
// 🔒 Los dos bordes salen de la CONSTANTE, no de un 1000 escrito a mano: si el tope cambia, este
//    test tiene que seguir preguntando por el tope, no por el número que tenía el día que se
//    escribió.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

/** Facturas sin líneas: se EXCLUYEN (no hay desglose que declarar), así que el XML sale corto. */
const mkRelleno = (n) => Array.from({ length: n }, (_, i) =>
  mkInvoice({ number: `2026-CF-R${i}`, lines: [], vfHash: null }));

test('SCRUM-844c · 🔴 pasado el tope NO se emite un XML a medias: se falla en claro', async () => {
  const demasiadas = mkRelleno(MAX_REGISTROS_POR_ENVIO + 1);
  await assert.rejects(
    () => construir(demasiadas),
    (e) => {
      assert.match(e.message, /^verifactu_demasiados_registros:/,
        `🔴 con ${MAX_REGISTROS_POR_ENVIO + 1} facturas se ha construido un XML que la AEAT no `
        + `admite, en vez de parar. Salió: ${e.message}`);
      // El error dice CUÁNTAS eran: sin el número, quien lo recibe no sabe cuánto se pasó.
      assert.ok(e.message.endsWith(`:${MAX_REGISTROS_POR_ENVIO + 1}`),
        `🔴 el error no dice cuántos registros había: ${e.message}`);
      return true;
    },
  );
});

test('SCRUM-844c · ✅ EN el tope exacto todavía se emite (el corte es «más que», no «tantos como»)', async () => {
  // Un corte con `>=` dejaría fuera un envío perfectamente válido, y nadie lo notaría hasta que
  // un merchant con exactamente el tope de facturas se quedara sin su registro.
  const justas = [...mkRelleno(MAX_REGISTROS_POR_ENVIO - 1), mkInvoice()];
  assert.equal(justas.length, MAX_REGISTROS_POR_ENVIO, 'el banco no tiene el tamaño del tope');
  const { count } = await construir(justas);
  assert.equal(count, 1,
    `🔴 con exactamente ${MAX_REGISTROS_POR_ENVIO} facturas el envío tiene que salir (una `
    + `declarable y el resto excluidas por no tener líneas), y ha salido count=${count}`);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 4 · LA GUARDA FAIL-CLOSED DEL PRODUCTOR — y por qué aquí se mira la ESTRUCTURA
//
// 🔴 ESTE PUNTO NO ADMITE PRUEBA DE COMPORTAMIENTO, Y EL MOTIVO ESTÁ MEDIDO, no supuesto:
//
// Los cinco datos del productor son CONSTANTES LITERALES de `productor.ts`, no variables de
// entorno, y su propio fichero declara que no hay override «ni de test» —decisión del fundador—.
// Así que desde fuera no existe ninguna forma de que `!productor.nif` sea cierto: la guarda es
// HOY INALCANZABLE, y por eso su mutación sobrevive sin cambiar el comportamiento de nada.
// Medido: sustituir la condición entera por `if (false)` no tumba NI UN test de los que llegan a
// esta función — ni siquiera con el banco de pruebas emitiendo XML de verdad.
//
// > Un mutante que sobrevive puede ser un hueco de la red… o una condición que el propio código
// > hace inalcanzable. Decir lo primero de lo segundo es publicar un agujero que no existe.
//
// La guarda NO sobra: es lo que sostiene el fail-closed el día que una constante se quede vacía
// en un PR —que es exactamente el defecto que `productor.ts` cuenta haber sufrido, con las cinco
// viviendo en un panel y ausentes en producción—. Lo que se puede vigilar, y es lo que se hace:
//   ① que la guarda siga ahí y siga mirando LOS CINCO campos (por AST, no por texto);
//   ② que ninguna constante esté vacía — porque es lo que mantiene la guarda inalcanzable.
// ② ya lo vigila `scrum247`; aquí se comprueba el ENLACE entre las dos, que es lo que ninguno
// de los dos ficheros puede ver por su cuenta.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

const CAMPOS_DEL_PRODUCTOR = ['nombre', 'nif', 'idSistema', 'version', 'numInstalacion'];

test('SCRUM-844c · ✅ con el productor REAL configurado, el registro sale (no hay fail-closed espurio)', async () => {
  const { count } = await construir([mkInvoice()]);
  assert.equal(count, 1,
    '🔴 la guarda del productor está bloqueando una emisión legítima. Este control positivo es '
    + 'la otra mitad: una guarda que siempre lanza también es un defecto, y muy caro.');
});

test('SCRUM-844c · 🔴 la guarda del productor sigue ahí y mira LOS CINCO campos', () => {
  const codigo = fs.readFileSync(DECLARACION, 'utf8');
  const sf = ts.createSourceFile(DECLARACION, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  // Se busca por AST el `if` cuyo cuerpo lanza `verifactu_productor_no_configurado`, y se leen
  // los campos que consulta su condición. Por TEXTO no valdría: el nombre del error aparece
  // también en los comentarios de este mismo fichero, así que un `grep` seguiría verde con la
  // guarda borrada (la lección de SCRUM-745).
  let condicion = null;
  const visitar = (n) => {
    if (ts.isIfStatement(n) && /verifactu_productor_no_configurado/.test(n.thenStatement.getText())) {
      condicion = n.expression.getText();
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);

  assert.ok(condicion,
    '🔴 ha desaparecido la guarda que impide emitir SIN PRODUCTOR configurado. Sin ella, el día '
    + 'que una de las cinco constantes se quede vacía en un PR, YaQu emitiría un registro fiscal '
    + 'que miente sobre quién fabricó el software, en vez de pararse.');

  const ausentes = CAMPOS_DEL_PRODUCTOR.filter((c) => !new RegExp(`\\b${c}\\b`).test(condicion));
  assert.deepEqual(ausentes, [],
    `🔴 la guarda ya no mira ${ausentes.join(', ')}. Cada campo que sale de la condición es un `
    + `dato del productor que podría irse VACÍO al XML. Condición actual: ${condicion}`);
});

test('SCRUM-844c · 🔴 EL ENLACE: la guarda es inalcanzable PORQUE ninguna constante está vacía', () => {
  // Si esto cae, el test de arriba deja de ser estructural y pasa a ser un agujero de verdad:
  // significaría que la condición SÍ se puede cumplir, y entonces la emisión está parada.
  const vacias = Object.entries(PRODUCTOR_VERIFACTU)
    .filter(([, v]) => !v || String(v).trim() === '')
    .map(([k]) => k);
  assert.deepEqual(vacias, [],
    `🔴 ${vacias.join(', ')} está vacía. La guarda fail-closed de `
    + '`buildVerifactuRegistrosXml` ha dejado de ser inalcanzable: a partir de ahora ESTE '
    + 'merchant no puede emitir su registro. Es un STOP, no un fallo de test.');
  assert.equal(Object.keys(PRODUCTOR_VERIFACTU).length, CAMPOS_DEL_PRODUCTOR.length,
    '🔴 el productor ya no tiene cinco datos: la guarda de arriba está mirando una lista que ya '
    + 'no es la del fichero, y este enlace dejó de medir lo que dice medir');
});

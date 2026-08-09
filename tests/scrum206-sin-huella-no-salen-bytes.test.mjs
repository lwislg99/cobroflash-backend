// SCRUM-206 · si la factura debe estar en la cadena y no lo está, NO SALEN BYTES.
// (sin gate: ni BD ni red. El sellado se hace fallar con un cliente Prisma falso.)
//
// Una factura sin huella es una factura que a ojos de la AEAT no está encadenada. Eso no es un
// error recuperable que se tape con una línea de log: es un documento inválido entregado. Y se
// entregaba CON un QR —el fallback casero `INV:…|AMOUNT:…`—, así que el documento aparentaba
// estar completo. Uno de los cuatro caminos era `GET /recibo/:token/pdf`, que es público: el
// clic del cliente final disparaba el fail-open.
//
// SUELO ANTI-VERDE-HUECO: estas comprobaciones pasarían en vacío sobre un escenario que solo
// tenga facturas de un tipo. Si no hay ninguna que DEBA sellarse, «no salen bytes» no se ha
// probado; si no hay ninguna J-/no-ES, no se ha probado que el portón no bloquee lo que es
// legítimo. El conjunto declara y COMPRUEBA que tiene de los dos antes de afirmar nada.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// El builder de VeriFactu exige la identificación del productor; se fija ANTES del primer
// import de `dist` porque la config se congela ahí (mismo patrón que SCRUM-145/153).
// SCRUM-247: aqui se fijaban las cinco `process.env.VERIFACTU_*` del PRODUCTOR. Ya no hacen
// nada: son CONSTANTES del repo (`src/modules/fiscal/verifactu/productor.ts`), no configuracion.
// Se retiran en vez de dejarlas: una asignacion inerte se lee como si tuviera efecto.

const {
  puedeSalirDocumento, debeEstarEnLaCadena, exigirDocumentoEmitible,
  esErrorSinSellar, ERROR_SIN_SELLAR, COPY_PUBLICO_SIN_SELLAR,
} = await import('../dist/modules/invoicing/domain/portonDocumento.js');
const { ensureInvoicePdf } = await import('../dist/lib/invoicing.js');

const ES = { country: 'ES', taxId: 'B12345678' };

/** Escenarios: los que DEBEN sellarse y los que legítimamente no llevan huella. */
const ESCENARIOS = [
  { nombre: 'F1 española sin huella',        inv: { number: '2026-FG-001', vfHash: null }, merchant: ES,                                debeSellarse: true,  puedeSalir: false },
  { nombre: 'F1 española CON huella',        inv: { number: '2026-FG-002', vfHash: 'A'.repeat(64) }, merchant: ES,                      debeSellarse: true,  puedeSalir: true },
  { nombre: 'justificante J- (regla 26)',    inv: { number: 'J-2026-001', vfHash: null }, merchant: ES,                                 debeSellarse: false, puedeSalir: true },
  { nombre: 'merchant NO español',           inv: { number: '2026-FG-003', vfHash: null }, merchant: { country: 'PT', taxId: 'X1' },     debeSellarse: false, puedeSalir: true },
  { nombre: 'merchant ES sin NIF',           inv: { number: '2026-FG-004', vfHash: null }, merchant: { country: 'ES', taxId: null },     debeSellarse: false, puedeSalir: true },
];

function exigirLosDosTipos(escenarios) {
  const deben = escenarios.filter((e) => e.debeSellarse).length;
  const noDeben = escenarios.length - deben;
  assert.ok(
    deben > 0 && noDeben > 0,
    `🔴 SUELO ANTI-VERDE-HUECO: ${deben} escenarios que deben sellarse y ${noDeben} que no. ` +
      'Hacen falta los dos: sin los primeros no se prueba que se bloquee lo inválido, y sin los ' +
      'segundos no se prueba que NO se bloquee lo legítimo. Un verde aquí solo diría que no miré.',
  );
  return { deben, noDeben };
}

// ── el portón, en las dos direcciones ─────────────────────────────────────────────────────

test('SCRUM-206 · el portón bloquea lo que debe estar sellado y no lo está, y solo eso', () => {
  exigirLosDosTipos(ESCENARIOS);

  for (const e of ESCENARIOS) {
    assert.equal(
      debeEstarEnLaCadena(e.inv.number, e.merchant), e.debeSellarse,
      `🔴 «${e.nombre}»: el portón no coincide con la condición que ya usaban los cuatro sitios ` +
        'antes de sellar. Si aquí difiere, el portón estaría cambiando el ALCANCE del sellado ' +
        'además de cerrar el fail-open, y eso no es este ticket.',
    );
    assert.equal(
      puedeSalirDocumento(e.inv, e.merchant), e.puedeSalir,
      `🔴 «${e.nombre}»: puedeSalirDocumento debería ser ${e.puedeSalir}.`,
    );
  }
});

test('SCRUM-206 · el rechazo lleva código propio, no un error genérico', () => {
  // Se ramifica por CÓDIGO y nunca por el texto (SCRUM-151). Y la causa original se conserva:
  // el llamador necesita decidir, quien depura necesita el error de verdad.
  let capturado = null;
  try {
    exigirDocumentoEmitible({ number: '2026-FG-001', vfHash: null }, ES);
  } catch (e) { capturado = e; }

  assert.ok(capturado, '🔴 el portón NO lanzó sobre una factura española sin huella');
  assert.equal(capturado.code, ERROR_SIN_SELLAR);
  assert.ok(esErrorSinSellar(capturado), '🔴 esErrorSinSellar no reconoce su propio error');
  assert.ok(!esErrorSinSellar(new Error('cualquier_otra_cosa')), '🔴 reconoce errores ajenos como suyos');
});

// ── (a) y (c) · ensureInvoicePdf: ni bytes ni QR falso persistido ──────────────────────────

/** Cliente Prisma falso que REGISTRA cada escritura y hace fallar el sellado. */
function prismaFalso(inv, merchant) {
  const escrituras = [];
  const cliente = {
    escrituras,
    invoice: {
      findUnique: async () => ({
        id: 1, lines: [], total: { toString: () => '121.00' }, currency: 'EUR',
        createdAt: new Date(), pdfUrl: 'PENDING_PDF', qrData: 'PENDING_QR',
        merchantId: 7, customerId: 1, type: 'F1', stageLabel: null, rectifies: null,
        ...inv,
        merchant: { id: 1, name: 'Fontanería Pepe', legalName: null, address: null, logoUrl: null, whatsappPhone: null, email: null, ...merchant },
        customer: { id: 1, name: 'Cliente', email: null, phone: null },
      }),
      update: async (args) => { escrituras.push(args); return { ...inv, ...args.data }; },
      findFirst: async () => null,
      findMany: async () => [],
    },
    // El sellado revienta aquí: `applyVeriFactu` abre transacción para tomar el cerrojo.
    $transaction: async () => { throw new Error('sellado_revento_en_la_transaccion'); },
    $queryRaw: async () => [],
  };
  return cliente;
}

test('SCRUM-206 · (a) una ES con taxId y vfHash null NO produce documento', async () => {
  const prisma = prismaFalso({ number: '2026-FG-001', vfHash: null }, ES);

  await assert.rejects(
    () => ensureInvoicePdf(1, prisma),
    (e) => {
      assert.ok(
        esErrorSinSellar(e),
        `🔴 ensureInvoicePdf falló con «${e?.message}» en vez del código del portón. Los llamadores ` +
          'ramifican por código: sin él, la ruta pública no puede devolver su 409 y acaba en un 500.',
      );
      return true;
    },
    '🔴 ENTREGÓ EL DOCUMENTO. Una factura española sin huella no está encadenada a ojos de la ' +
      'AEAT: entregarla es entregar un documento inválido, y esta ruta cuelga de `/recibo/:token/pdf`, ' +
      'que es PÚBLICA. Antes de SCRUM-206 el `catch` registraba el fallo y seguía.',
  );
});

test('SCRUM-206 · (c) el QR casero NO se persiste cuando la factura debía sellarse', async () => {
  const prisma = prismaFalso({ number: '2026-FG-001', vfHash: null }, ES);

  // NO se exige rechazo aquí a propósito. La primera versión de este test empezaba con un
  // `assert.rejects` y, contra el código con el fail-open, fallaba EN ESA LÍNEA con «Missing
  // expected rejection» — o sea que las comprobaciones del QR no llegaban a ejecutarse nunca y
  // el rojo estaba probando lo mismo que el test (a), no lo suyo (incidente #12). Lo que se mide
  // aquí es qué quedó ESCRITO, y eso se mide igual de bien resuelva o lance.
  await ensureInvoicePdf(1, prisma).catch(() => {});

  const conQrFalso = prisma.escrituras.filter((a) => String(a?.data?.qrData ?? '').startsWith('INV:'));
  assert.deepEqual(
    conQrFalso, [],
    '🔴 SE PERSISTIÓ EL QR CASERO (`INV:…|AMOUNT:…`) sobre una factura sin huella. Eso es peor que ' +
      'no tener QR: el documento APARENTA estar completo — lleva algo con forma de código ' +
      'verificable que no lo es. El fallback solo vale para J-/no-ES, que no llevan QR de AEAT.',
  );
  assert.deepEqual(
    prisma.escrituras, [],
    '🔴 hubo escrituras sobre la factura tras fallar el sellado. No se toca nada: ni `pdfUrl`, ni ' +
      '`qrData`. Y el número NO se revierte (regla 29) — revertir es lo que crearía el hueco en la serie.',
  );
});

// ── (b) · los otros tres consumidores, y el censo que fuerza a decidir sobre el cuarto ─────

test('SCRUM-206 · (b) los consumidores de `ensureInvoicePdf` no convierten el rechazo en éxito', () => {
  // El portón vive DENTRO de `ensureInvoicePdf`, así que los cuatro caminos lo heredan y no hay
  // que probar cuatro veces la misma garantía. Lo que sí hay que fijar es que ninguno lo TRAGUE
  // y siga como si nada — que es la forma en que el fail-open volvería, un nivel más arriba.
  const CONSUMIDORES = {
    'src/modules/billing/app/routes/receipt.routes.ts': 'esErrorSinSellar',   // 409 + copy público
    'src/modules/system/app/routes/invoicesAdmin.routes.ts': 'esErrorSinSellar', // 409 + código
    'src/modules/exports/app/routes/exports.routes.ts': 'ok: false',          // se excluye del ZIP y se lista en `fallidos`
    'src/modules/messaging/domain/email.service.ts': null,                    // propaga: no hay catch, no se envía
  };

  const encontrados = [];
  const dirSrc = path.join(RAIZ, 'src');
  const recorrer = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) recorrer(p);
      else if (e.name.endsWith('.ts')) {
        const codigo = fs.readFileSync(p, 'utf8')
          .split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
        if (/\bensureInvoicePdf\s*\(/.test(codigo)) {
          encontrados.push({ rel: path.relative(RAIZ, p).split(path.sep).join('/'), codigo });
        }
      }
    }
  };
  recorrer(dirSrc);

  // Se excluye el fichero donde se DECLARA: llamarse a sí misma no cuenta.
  const llamadores = encontrados.filter((f) => f.rel !== 'src/lib/invoicing.ts');

  assert.ok(
    llamadores.length > 0,
    '🔴 ESCÁNER CIEGO: ningún llamador de `ensureInvoicePdf`. Si se renombró, este guard dejó de vigilar.',
  );

  const nuevos = llamadores.map((f) => f.rel).filter((r) => !(r in CONSUMIDORES));
  assert.deepEqual(
    nuevos, [],
    '🔴 HAY UN CONSUMIDOR NUEVO de `ensureInvoicePdf`:\n' + nuevos.map((r) => `    ${r}`).join('\n') +
      '\n\n  No es un fallo: es una DECISIÓN pendiente. Ese camino puede recibir el rechazo del\n' +
      '  portón, y hay que elegir qué hace — devolverlo al usuario, excluir el documento y\n' +
      '  reportarlo, o propagar. Lo único inaceptable es tragarlo y seguir. Añádelo aquí con su\n' +
      '  forma de tratarlo.',
  );

  for (const [rel, marca] of Object.entries(CONSUMIDORES)) {
    const f = llamadores.find((x) => x.rel === rel);
    assert.ok(f, `🔴 ESCÁNER CIEGO: ${rel} ya no llama a ensureInvoicePdf — ¿se movió?`);
    if (marca) {
      assert.ok(
        f.codigo.includes(marca),
        `🔴 ${rel} ya no trata el rechazo del portón (falta «${marca}» en su código ejecutable).\n\n` +
          '  Sin eso, el rechazo cae en su catch genérico y el camino sigue como si el documento\n' +
          '  existiera. Es el mismo fail-open, movido un nivel arriba.',
      );
    }
  }
});

// ── (d) · pdfEntregadoIgual dice lo que PASÓ, no lo que se sabía en el instante del catch ──

// ── (d) · RE-ANCLADO EN OTRO FICHERO, y esto no es una retirada ────────────────────────────
//
// Aquí vivía: «`pdfEntregadoIgual: false` va atado a un `throw` en el mismo bloque». Esa era la
// FORMA de la propiedad cuando `lib/invoicing.ts` sellaba y, al fallar, seguía entregando: la
// única manera de cortar era lanzar.
//
// SCRUM-205 mueve el sellado al punto único (`sellarTrasEmision`), donde `throw` sería
// incorrecto —obligaría a cada llamador a decidir qué hacer con un número YA consumido—, así
// que la forma pasa a ser «registrar y devolver un estado que el portón bloquea». Este fichero
// se quedaría con un escáner ciego: 0 usos de `pdfEntregadoIgual` en `lib/invoicing.ts`.
//
// LA PROPIEDAD NO SE PIERDE: vive en `tests/scrum205-fallo-de-sellado-no-entrega.test.mjs`, y
// allí es MÁS estricta — tres afirmaciones atadas en vez de una, porque el cambio de mecanismo
// abre un agujero que el `throw` no tenía: **un throw no se puede ignorar, un valor devuelto
// SÍ**. La tercera afirmación de allí (nadie descarta el resultado y entrega bytes) es la que
// sustituye a este test, y no existía antes.
test('SCRUM-206 · el copy del rechazo público no explica VeriFactu (reglas 26 y 30)', () => {
  // El destinatario es el cliente de un fontanero. Y la regla 26 prohíbe explicarle VeriFactu.
  assert.equal(
    COPY_PUBLICO_SIN_SELLAR,
    'Esta factura se está registrando en Hacienda. Vuelve a intentarlo en un minuto.',
  );
  for (const prohibida of ['VeriFactu', 'sellad', 'huella', 'hash', 'cadena', 'error', 'AEAT']) {
    assert.ok(
      !COPY_PUBLICO_SIN_SELLAR.toLowerCase().includes(prohibida.toLowerCase()),
      `🔴 el copy público dice «${prohibida}». Ni jerga técnica ni explicaciones de VeriFactu.`,
    );
  }
});

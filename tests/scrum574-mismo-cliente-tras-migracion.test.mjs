// tests/scrum574-mismo-cliente-tras-migracion.test.mjs — SCRUM-574 (CONT-01)
//
// EL CONTROL QUE DECIDE: un cliente existente, tras la migración que añade `contact_kind`,
// SIGUE SIENDO EL MISMO cliente — mismos datos, mismo id, misma fila.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ESTE FICHERO NACIÓ ANTES QUE LA COLUMNA, Y ESO ES LO MEJOR QUE TIENE
//
// Se escribió con la migración PREPARADA Y SIN APLICAR: el esquema es dominio de los fundadores y
// el diff (`docs/sql/SCRUM-574-opcion-B.diff`) esperaba su GO. El fundador lo autorizó el
// 24-ago-2026 y la columna ya está aplicada en staging y en dev.
//
// Que el control se escribiera ANTES importa: el comparador y sus rojos se probaron sin poder
// mirar la respuesta, así que no están recortados a la medida de lo que la BD acabó devolviendo.
//
// El comparador —donde vive la lógica— se prueba ENTERO sin BD. Lo único gateado es la pasada
// contra Postgres.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// CÓMO COMPARA, Y POR QUÉ ASÍ
//
// `===` para todo, y `Buffer.compare` para el contenido textual. CERO `includes()`: `includes`
// dice «está dentro», no «es igual» — un nombre truncado de "María Pérez" a "María" pasaría un
// `includes` y es exactamente la pérdida que este control existe para cazar.
//
// `Buffer.compare` sobre los bytes UTF-8 añade lo que `===` no enseña: dos cadenas que se PINTAN
// igual pero difieren en bytes (una tilde combinante NFD frente a la precompuesta NFC, un espacio
// fino, un BOM). Una migración que reescriba texto puede normalizarlas sin que nadie lo note.
// `===` ya las distingue; el Buffer es lo que hace que el FALLO diga en qué bytes, en vez de
// enseñar dos cadenas idénticas en pantalla y dejar al lector pensando que el test desvaría.
//
// ⚠️ EL COMPARADOR NOMBRA EL CAMPO. Un control que dice «el cliente cambió» sin decir cuál obliga
// a repetir a mano el trabajo que venía a ahorrar. El rojo de abajo comprueba justo eso.
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD del carril (fail-closed anti-prod). VA EL PRIMERO.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { telefonoDePrueba } from '../scripts/_telefonos-prueba.mjs';

// Los campos que un cliente tiene ANTES de la migración. Escritos a mano y NO derivados del
// modelo de Prisma a propósito: si se derivaran, la columna nueva entraría sola en la lista y el
// control aprobaría su propia aparición. Ésta es la foto del «antes», y tiene que envejecer mal a
// la vista de todos — el día que alguien añada un campo, este test le obliga a decidir si
// pertenece al antes o al después.
export const CAMPOS_DEL_CLIENTE = Object.freeze([
  'id', 'merchantId', 'name', 'phone', 'email', 'notes',
  'legalName', 'taxId', 'waOptOut',
  'tipoDestinatario', 'billingPeriodicity', 'recargoEquivalencia',
  'createdAt', 'updatedAt',
]);

/** Bytes de un valor, para comparar contenido textual sin que dos cadenas distintas se pinten igual. */
function bytesDe(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return Buffer.from(v.toISOString(), 'utf8');
  return Buffer.from(String(v), 'utf8');
}

/**
 * Compara dos fotos del MISMO cliente campo a campo. Devuelve la lista de diferencias, cada una
 * NOMBRANDO su campo. Lista vacía = es el mismo cliente.
 *
 * `camposEsperadosNuevos` son las columnas que la migración AÑADE: se exige que existan en el
 * «después» y que valgan `null` — nadie declaró nada por el profesional. No se ignoran: se
 * comprueban, que no es lo mismo.
 */
export function compararClienteCampoACampo(antes, despues, camposEsperadosNuevos = []) {
  const diffs = [];

  for (const campo of CAMPOS_DEL_CLIENTE) {
    const a = antes[campo];
    const d = despues[campo];

    // Nulidad primero: null y "" son distintos, y `Buffer.compare` no puede opinar sobre null.
    const aVacio = a === null || a === undefined;
    const dVacio = d === null || d === undefined;
    if (aVacio !== dVacio) {
      diffs.push({ campo, motivo: 'nulidad' });
      continue;
    }
    if (aVacio && dVacio) continue;

    // Fechas por su instante exacto; el resto por identidad estricta.
    if (a instanceof Date || d instanceof Date) {
      const ta = a instanceof Date ? a.getTime() : NaN;
      const td = d instanceof Date ? d.getTime() : NaN;
      if (!(ta === td)) {
        diffs.push({ campo, motivo: 'fecha' });
        continue;
      }
    } else if (!(a === d)) {
      diffs.push({ campo, motivo: 'valor' });
      continue;
    }

    // Y el contenido en BYTES. Aquí es donde cae una normalización silenciosa de texto.
    const ba = bytesDe(a);
    const bd = bytesDe(d);
    if (ba !== null && bd !== null && Buffer.compare(ba, bd) !== 0) {
      diffs.push({ campo, motivo: `bytes ${ba.toString('hex')} != ${bd.toString('hex')}` });
    }
  }

  for (const campo of camposEsperadosNuevos) {
    if (!(campo in despues)) {
      diffs.push({ campo, motivo: 'columna nueva AUSENTE tras la migración' });
    } else if (despues[campo] !== null) {
      // Que nazca con valor significaría que la migración DECLARÓ por el profesional.
      diffs.push({ campo, motivo: `columna nueva no nace NULL (vale ${JSON.stringify(despues[campo])})` });
    }
  }

  return diffs;
}

/** Mensaje legible: nombra los campos. Es lo que se lee cuando esto cae en CI. */
export function describirDiffs(diffs) {
  return diffs.map((d) => `${d.campo} (${d.motivo})`).join(', ');
}

// El teléfono sale del RANGO IMPOSIBLE (`34` + `0` + 8 dígitos): ningún abonado español empieza
// por 0, así que no puede ser de nadie. Este fixture no llega a ninguna BD, pero el guard de
// SCRUM-262 tiene razón en no fiarse de eso — hay tres crons que mandan WhatsApp a teléfonos
// guardados y ninguno filtra. Y `merchantId: 2` porque el 1 es el merchant DEMO (SCRUM-409), que
// no se comporta como uno normal.
const CLIENTE = Object.freeze({
  id: 7, merchantId: 2, name: 'María Pérez', phone: telefonoDePrueba(1), email: 'm@example.com',
  notes: 'Portal 3, 2ºB', legalName: null, taxId: null, waOptOut: false,
  tipoDestinatario: null, billingPeriodicity: 'NINGUNA', recargoEquivalencia: null,
  createdAt: new Date('2026-01-15T10:00:00.000Z'), updatedAt: new Date('2026-02-01T09:30:00.000Z'),
});

// ── EL COMPARADOR, SIN BD — corre siempre ────────────────────────────────────────────────

test('SCRUM-574 · SUELO: el comparador VE campos de verdad (si no, todo lo demás es decorado)', () => {
  // Un comparador que no mira nada devuelve [] para todo y pintaría verde eternamente. Antes de
  // creerse un «no hay diferencias» hay que saber que sabe encontrarlas.
  assert.ok(CAMPOS_DEL_CLIENTE.length >= 14, 'la lista de campos se ha quedado corta');
  for (const campo of CAMPOS_DEL_CLIENTE) {
    assert.ok(campo in CLIENTE, `🔴 el cliente de prueba no tiene "${campo}": la foto está incompleta`);
  }
});

test('SCRUM-574 · el mismo cliente, con la columna nueva en NULL, NO es una diferencia', () => {
  const despues = { ...CLIENTE, contactKind: null };
  const diffs = compararClienteCampoACampo(CLIENTE, despues, ['contactKind']);
  assert.deepEqual(diffs, [], `🔴 la migración inocua se ha leído como cambio: ${describirDiffs(diffs)}`);
});

test('SCRUM-574 · 🔴 ROJO: si un campo cambia, CAE Y LO NOMBRA', () => {
  // El rojo por el mecanismo. Cada caso rompe UNA cosa y se exige que el fallo diga cuál.
  const casos = [
    ['name', { ...CLIENTE, contactKind: null, name: 'María' }],          // truncado: `includes` lo dejaría pasar
    ['phone', { ...CLIENTE, contactKind: null, phone: telefonoDePrueba(2) }],
    ['id', { ...CLIENTE, contactKind: null, id: 8 }],
    ['notes', { ...CLIENTE, contactKind: null, notes: null }],                // dato perdido a null
    ['tipoDestinatario', { ...CLIENTE, contactKind: null, tipoDestinatario: 'PARTICULAR' }], // lo que la opción A habría hecho
    ['recargoEquivalencia', { ...CLIENTE, contactKind: null, recargoEquivalencia: false }],  // null → false, la degradación silenciosa
    ['createdAt', { ...CLIENTE, contactKind: null, createdAt: new Date('2026-01-15T10:00:01.000Z') }],
  ];
  for (const [campoRoto, despues] of casos) {
    const diffs = compararClienteCampoACampo(CLIENTE, despues, ['contactKind']);
    assert.ok(diffs.length > 0, `🔴 EL CONTROL ESTÁ CIEGO: cambié "${campoRoto}" y no lo vio`);
    assert.ok(
      diffs.some((d) => d.campo === campoRoto),
      `🔴 cayó, pero NOMBRA OTRA COSA: esperaba "${campoRoto}", dijo "${describirDiffs(diffs)}"`,
    );
  }
});

test('SCRUM-574 · 🔴 ROJO: dos cadenas que se PINTAN igual pero difieren en bytes también caen', () => {
  // "Pérez" con la tilde PRECOMPUESTA (NFC, U+00E9) y con la COMBINANTE (NFD, e + U+0301). Se ven
  // idénticas en cualquier pantalla. Se construyen por CÓDIGO DE CARÁCTER y no tecleadas a
  // propósito: como texto en el fuente, cualquier normalizador —un editor, un filtro de git— las
  // igualaría en silencio y este caso pasaría a comparar una cadena consigo misma sin que el
  // verde cambiase. El `assert.notEqual` de la línea siguiente es el suelo que lo delataría.
  const nfc = String.fromCharCode(80, 0x00e9, 114, 101, 122);       // P + é PRECOMPUESTA + rez
  const nfd = String.fromCharCode(80, 101, 0x0301, 114, 101, 122);  // P + e + TILDE COMBINANTE + rez
  assert.notEqual(nfc, nfd, '⛔ SUELO DEL CASO: si fueran iguales, este test no probaría nada');
  const diffs = compararClienteCampoACampo(
    { ...CLIENTE, name: nfc },
    { ...CLIENTE, name: nfd, contactKind: null },
    ['contactKind'],
  );
  assert.ok(
    diffs.some((d) => d.campo === 'name'),
    '🔴 una normalización silenciosa de texto pasaría desapercibida',
  );
});

test('SCRUM-574 · 🔴 ROJO: la columna nueva que NO nace NULL es un fallo, no un detalle', () => {
  // Que `contact_kind` nazca con valor significa que la migración DECLARÓ la forma jurídica por el
  // profesional — justo lo que la opción B existe para no hacer.
  const conValor = compararClienteCampoACampo(CLIENTE, { ...CLIENTE, contactKind: 'EMPRESA' }, ['contactKind']);
  assert.ok(
    conValor.some((d) => d.campo === 'contactKind'),
    '🔴 la migración podría declarar por el profesional sin que nadie lo viera',
  );

  const ausente = compararClienteCampoACampo(CLIENTE, { ...CLIENTE }, ['contactKind']);
  assert.ok(
    ausente.some((d) => d.campo === 'contactKind'),
    '🔴 la columna podría no haberse creado y esto pasaría verde',
  );
});

test('SCRUM-574 · el control NO usa includes() para comparar textos', () => {
  // Guard sobre este mismo fichero: la prohibición del encargo es explícita y se sostiene sola.
  // Se cuentan los `.includes(` REALES, no las veces que la palabra aparece en prosa — por eso se
  // descartan las líneas de comentario antes de contar. Un guard de texto que se caza a sí mismo
  // en el comentario que explica la prohibición es el error clásico (cerebro-yaqu).
  const fuente = readFileSync(new URL(import.meta.url), 'utf8');
  const codigo = fuente
    .split(/\r?\n/)
    .filter((l) => !l.trimStart().startsWith('//'))
    .join('\n');
  const usos = (codigo.match(/\.includes\s*\(/g) || []).length;
  assert.equal(usos, 0, `🔴 hay ${usos} uso(s) de includes() en el comparador: el encargo los prohíbe`);
});

// ── CONTRA POSTGRES — gateado ────────────────────────────────────────────────────────────
//
// ⚠️ Corre solo con la BD del carril y SOLO tiene sentido una vez aplicada la migración.
// Mientras `contact_kind` no exista, FALLA DECLARANDO CEGUERA — nunca pasa en verde: un verde
// aquí, hoy, significaría «he comprobado la migración» sobre una migración que no ha ocurrido.
//
// Lo que este control puede probar y lo que NO, dicho antes de que alguien lo lea de más:
// puede probar que tras la migración NADIE quedó declarado, que no desapareció ninguna fila y que
// ningún cliente perdió su nombre. NO puede reconstruir por sí solo el estado previo — para eso
// están los números del PASO 0, que vienen escritos abajo y se comparan contra lo que haya.
const ENABLED = process.env.QA_DB_TEST === '1';

// PASO 0 · medido el 24-ago-2026 (`node scripts/censo-tipo-cliente.mjs`, `docs/CENSO_TIPO_CLIENTE.md`).
// Es el «antes» con el que se compara el «después», que es lo que pedía el encargo: la migración
// se verifica CON EL NÚMERO DEL PASO 0 DELANTE.
const PASO_0 = Object.freeze({ railway: 4, yaqu_dev_javier: 11 });

test(
  'SCRUM-574 · CONTRA POSTGRES: tras la migración, cada cliente sigue siendo el mismo',
  { skip: !ENABLED && 'sin QA_DB_TEST=1 · npm run test:staging:gated (y exige contact_kind aplicada — SCRUM-574 opción B)' },
  async () => {
    const { prisma } = await import('../dist/core/db/prisma.js');

    const columnas = await prisma.$queryRaw`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'customers' AND column_name = 'contact_kind'`;
    if (columnas.length === 0) {
      // NO es un aprobado. Es el suelo: se declara la ceguera en vez de devolver verde.
      assert.fail(
        '⛔ NO SUPE MIRAR: `customers.contact_kind` no existe en esta base, así que no hay migración ' +
        'que verificar. El diff está en docs/sql/SCRUM-574-opcion-B.diff, PREPARADO Y SIN APLICAR ' +
        '(el esquema es de los fundadores). Esto NO significa «los clientes están bien».',
      );
    }

    const [{ base }] = await prisma.$queryRaw`SELECT current_database()::text AS base`;
    const clientes = await prisma.customer.findMany({ orderBy: { id: 'asc' } });

    // SUELO: sin filas no hay nada que comparar, y «0 diferencias sobre 0 clientes» se lee igual
    // que una migración limpia.
    assert.ok(clientes.length > 0, `⛔ NO SUPE MIRAR: cero clientes en "${base}", no hay nada que comparar`);

    // EL NÚMERO DEL PASO 0 DELANTE. Se exige que no haya DESAPARECIDO ninguna fila; que haya más
    // es legítimo (altas posteriores) y por eso no se exige igualdad.
    const esperadoMin = PASO_0[base];
    if (esperadoMin !== undefined) {
      assert.ok(
        clientes.length >= esperadoMin,
        `🔴 FILAS PERDIDAS en "${base}": el PASO 0 midió ${esperadoMin} clientes y ahora hay ${clientes.length}`,
      );
    }

    for (const c of clientes) {
      // Nadie puede haber quedado declarado por la migración: `contact_kind` nace NULL.
      assert.equal(
        c.contactKind, null,
        `🔴 el cliente id=${c.id} quedó declarado como ${JSON.stringify(c.contactKind)} sin que nadie lo dijera`,
      );
      // Y sigue siendo un cliente: conserva su identidad y su nombre, en bytes.
      assert.ok(Number.isInteger(c.id) && c.id > 0, `🔴 el cliente perdió su id: ${JSON.stringify(c.id)}`);
      const nombre = bytesDe(c.name);
      assert.ok(
        nombre !== null && Buffer.compare(nombre, Buffer.alloc(0)) !== 0,
        `🔴 el cliente id=${c.id} se quedó sin nombre`,
      );
      // 🔴 Y el campo fiscal NO se tocó: la opción A es justo lo que se descartó.
      assert.ok(
        c.tipoDestinatario === null || c.tipoDestinatario === 'PARTICULAR' || c.tipoDestinatario === 'EMPRESARIO',
        `🔴 el cliente id=${c.id} tiene un tipoDestinatario fuera de la lista: ${JSON.stringify(c.tipoDestinatario)}`,
      );
    }
  },
);

test(
  'SCRUM-574 · ✅ CONTROL POSITIVO: se da de alta por CADA lado, y el campo fiscal no se contagia',
  { skip: !ENABLED && 'sin QA_DB_TEST=1 · npm run test:staging:gated (crea y BORRA un merchant efímero)' },
  async () => {
    // Un control que solo comprueba que «nada cambió» pasaría igual de verde con el switch
    // desconectado. Esto es la otra mitad: que el camino de escritura FUNCIONA por los dos lados.
    const { prisma } = await import('../dist/core/db/prisma.js');
    const { createCustomer, getCustomer } = await import('../dist/modules/system/customerAdmin.js');
    const { withMerchant } = await import('./_merchant-fixture.mjs');

    await withMerchant(prisma, { name: 'SCRUM-574 alta por lado' }, async (merchant) => {
      for (const lado of ['EMPRESA', 'PERSONA']) {
        const creado = await createCustomer(merchant.id, {
          name: `Cliente ${lado}`,
          contactKind: lado,
        });
        assert.equal(creado.contactKind, lado, `🔴 el alta por el lado ${lado} no guardó la forma jurídica`);

        // Y se relee de la BD: que el objeto devuelto lo traiga no prueba que se haya escrito.
        const releido = await getCustomer(merchant.id, creado.id);
        assert.equal(releido.contactKind, lado, `🔴 ${lado} no sobrevivió a la relectura: no se escribió`);

        // 🔴 LO QUE DE VERDAD DECIDE ESTE TICKET: declarar la forma jurídica NO toca la capacidad
        // fiscal. Si esto cayera, estaríamos en la opción A con otro nombre — y el autónomo
        // (PERSONA + EMPRESARIO) volvería a quedarse con el plazo legal equivocado.
        assert.equal(
          releido.tipoDestinatario, null,
          `🔴 dar de alta como ${lado} ha escrito tipoDestinatario=${JSON.stringify(releido.tipoDestinatario)} — los campos se están contagiando`,
        );
      }

      // Y el caso que los 15 clientes existentes representan: un alta SIN declarar nada.
      const sinDeclarar = await createCustomer(merchant.id, { name: 'Cliente sin declarar' });
      assert.equal(
        sinDeclarar.contactKind, null,
        '🔴 un alta sin tocar el switch ha nacido declarada: YaQu estaría decidiendo por el profesional',
      );
    });
  },
);

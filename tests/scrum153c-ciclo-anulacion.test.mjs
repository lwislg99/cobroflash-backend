// SCRUM-153 (b) — el CICLO de anulación: emitir → anular → el alta sigue intacta, la anulación
// queda encadenada, y el XML trae los DOS registros.
//
// ⚠️ SE PIDIÓ COMO TEST GATEADO Y VA SIN GATE, a propósito. `applyVeriFactuAnulacion` y
// `buildVerifactuRegistrosXml` aceptan un `prismaClient` inyectable (lo hace ya SCRUM-145), así
// que los invariantes que importan —que el alta no se toca, que la anulación encadena con la
// huella anterior, y que el XML lleva los dos registros— se comprueban **sin base de datos**.
//
// Es el principio 3 de `docs/QA/SUITE_REGRESION.md`, sección «Escribir verificaciones»: lo que
// se pueda comprobar sin BD va en la suite normal. Y aquí pesa el doble, porque un test gateado
// **es uno que casi nunca corre** — hoy la tanda gateada necesita turno de staging (R6, una
// convención humana invisible: SCRUM-188) y devuelve rojos sin clasificar (SCRUM-160). Poner
// aquí la garantía fiscal del ciclo la habría dejado sin correr durante semanas.
//
// LO QUE ESTO NO CUBRE, y sí necesita staging con su turno — dicho en voz alta en vez de fingir
// cobertura: el endpoint `POST /admin/invoices/:id/annul` de punta a punta, la liberación real
// de los albaranes y la limpieza del libro de SCRUM-170. Eso toca BD y queda pendiente de una
// ventana de staging.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { soloEjecutable } from './_guard-texto.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// El builder del XML exige la identificación del PRODUCTOR (SistemaInformatico del XSD). Se
// fija ANTES del primer import de `dist`: la config se congela ahí. Mismo patrón que SCRUM-145.
// SCRUM-247: aqui se fijaban las cinco `process.env.VERIFACTU_*` del PRODUCTOR. Ya no hacen
// nada: son CONSTANTES del repo (`src/modules/fiscal/verifactu/productor.ts`), no configuracion.
// Se retiran en vez de dejarlas: una asignacion inerte se lee como si tuviera efecto.

const { applyVeriFactuAnulacion, buildVerifactuRegistrosXml, computeVeriFactuHash } =
  await import('../dist/modules/invoicing/domain/verifactu.service.js');

const merchant = { id: 1, country: 'ES', taxId: 'B12345678', legalName: 'QA Fontanería SL', name: 'QA' };

const factura = (over = {}) => ({
  id: 10,
  merchantId: 1,
  number: '2026-CF-001',
  createdAt: new Date('2026-03-15T10:00:00Z'),
  total: '121.00',
  type: 'F1',
    // SCRUM-209: mismo bug de fixture que scrum145 — `vat` no lo lee nadie; es `tax` en fracción.
  lines: [{ concept: 'Reparación', qty: 1, price: 100, tax: 0.21 }],
  vfHash: 'A'.repeat(64),
  vfPrevHash: null,
  vfAnulHash: null,
  vfAnulPrevHash: null,
  vfAnulTimestamp: null,
  customer: { name: 'Cliente QA', taxId: 'A11111111' },
  rectifies: null,
  ...over,
});

/**
 * prisma falso que además RECUERDA lo que se le escribió — así se puede comprobar que el
 * sellado de la anulación no toca ni un campo del alta, que es la mitad del ticket.
 */
function fakePrisma(invoices) {
  const escrituras = [];
  const cerrojos = [];
  const cliente = {
    escrituras,
    cerrojos,
    merchant: { findUnique: async () => merchant },
    invoice: {
      findMany: async (args) =>
        args?.where?.vfHash ? invoices.filter((i) => i.vfHash) : invoices,
      findUnique: async ({ where }) => invoices.find((i) => i.id === where.id) || null,
      findFirst: async (args) => {
        // `ultimaHuellaDeLaCadena` busca el último eslabón: altas Y anulaciones.
        const conHuella = invoices.filter((i) => i.vfAnulHash || i.vfHash);
        return conHuella[conHuella.length - 1] || null;
      },
      update: async ({ where, data }) => {
        escrituras.push({ id: where.id, data });
        const inv = invoices.find((i) => i.id === where.id);
        Object.assign(inv, data);
        return inv;
      },
    },
    // El cerrojo por merchant (SCRUM-173/177) se ANOTA en vez de ejecutarse: aquí no hay
    // Postgres. Se deja registrado —y con su assert— para que este doble no pueda ocultar que
    // el sellado dejó de tomarlo: la serialización de la cadena es lo que impide dos huellas
    // colgando del mismo eslabón, y perderla no daría un rojo sino una cadena rota en prod.
    $executeRaw: async (...args) => { cerrojos.push(args); return 1; },
    $transaction: async (fn) => (typeof fn === 'function' ? fn(cliente) : Promise.all(fn)),
  };
  return cliente;
}

// ── 1. El alta sobrevive intacta ─────────────────────────────────────────────────────────

test('SCRUM-153 · anular NO toca la huella del alta', async () => {
  const inv = factura();
  const altaAntes = { vfHash: inv.vfHash, vfPrevHash: inv.vfPrevHash, number: inv.number };
  const p = fakePrisma([inv]);

  await applyVeriFactuAnulacion(inv, merchant.taxId, p);

  assert.equal(
    inv.vfHash,
    altaAntes.vfHash,
    '🔴 la huella del ALTA cambió al anular. Regla 29: una factura emitida jamás se edita ni ' +
      'borra — la anulación AÑADE un registro, no reescribe el anterior. Si el alta se toca, la ' +
      'cadena de huellas de todo el ejercicio deja de validar.',
  );
  assert.equal(inv.vfPrevHash, altaAntes.vfPrevHash, '🔴 el eslabón anterior del alta cambió');
  assert.equal(inv.number, altaAntes.number, '🔴 el número cambió: no se renumera ni se reutiliza');

  assert.equal(
    p.cerrojos.length,
    1,
    '🔴 el sellado dejó de tomar el cerrojo por merchant (SCRUM-173/177). Sin él, dos sellados ' +
      'simultáneos pueden colgar del MISMO eslabón anterior y la cadena queda bifurcada — que no ' +
      'da un rojo aquí, da una cadena inválida en producción.',
  );

  // Y lo que SÍ se escribe: solo campos de anulación.
  const campos = p.escrituras.flatMap((e) => Object.keys(e.data));
  const intrusos = campos.filter((c) => !/^vfAnul/.test(c));
  assert.deepEqual(
    intrusos,
    [],
    `🔴 el sellado de la anulación escribió campos que no son suyos (${intrusos.join(', ')})`,
  );
});

// ── 2. La anulación encadena ─────────────────────────────────────────────────────────────

test('SCRUM-153 · la anulación queda sellada y ENCADENADA con la huella anterior', async () => {
  const inv = factura();
  const { vfAnulHash, vfPrevHash } = await applyVeriFactuAnulacion(inv, merchant.taxId, fakePrisma([inv]));

  assert.match(vfAnulHash, /^[A-F0-9]{64}$/i, '🔴 la huella de anulación no tiene forma de SHA-256');
  assert.notEqual(
    vfAnulHash,
    inv.vfHash,
    '🔴 la anulación reutiliza la huella del alta: serían el mismo registro y la cadena mentiría',
  );
  assert.equal(
    vfPrevHash,
    'A'.repeat(64),
    '🔴 la anulación no encadena con el último eslabón. La cadena es ÚNICA por merchant y ' +
      'mezcla altas y anulaciones: si la anulación no cuelga del alta anterior, se rompe.',
  );
});

// La IDEMPOTENCIA no vive en el sellado: vive en la RUTA. Lo comprobé asumiendo lo contrario y
// el test salió rojo — `applyVeriFactuAnulacion` sella cada vez que se le llama, y hace bien:
// su trabajo es sellar, no decidir si toca. Quien decide es el endpoint, que sale antes si la
// factura ya está anulada. Se fija ahí, que es donde está la garantía de verdad.
test('SCRUM-153 · la idempotencia la garantiza la RUTA, no el sellado', () => {
  // `soloEjecutable` (principio 10, adoptado hoy): la cabecera de esta ruta CITA
  // `applyVeriFactuAnulacion` en su comentario, antes de la guarda. Sin filtrar comentarios,
  // el `indexOf` lo encuentra ahí y el assert de orden falla contra prosa. Me pasó escribiendo
  // este mismo test — la cuarta vez en la sesión, y con el helper ya escrito.
  const ruta = soloEjecutable(fs.readFileSync(
    path.join(RAIZ, 'src', 'modules', 'system', 'app', 'routes', 'invoicesAdmin.routes.ts'),
    'utf8',
  ));
  const bloque = ruta.slice(ruta.indexOf("/:id/annul"));
  assert.ok(
    /invoice\.status === 'annulled'[\s\S]{0,220}yaEstaba/.test(bloque),
    '🔴 la ruta de anulación ya no sale antes cuando la factura YA está anulada. Sin esa salida ' +
      'se vuelve a sellar, y una SEGUNDA huella de baja de la misma factura es un registro ' +
      'falso en la cadena: describe una anulación que no ocurrió.',
  );
  // SCRUM-205 · este assert estaba anclado al NOMBRE `applyVeriFactuAnulacion`, y el sellado
  // se mudó al punto único (`sellarAnulacionTrasEmision`). El nombre desapareció del código
  // ejecutable de la ruta y `indexOf` devolvió -1 — el test se puso rojo por un motivo que no
  // era el suyo. Bien: prefiero ese rojo. Pero mirando el -1 de cerca aparece el agujero real:
  // en el orden CONTRARIO (si desapareciera la guarda en vez del sellado) el `-1` habría hecho
  // pasar la comparación EN VACÍO. Un guard que se apaga solo cuando renombran lo que vigila.
  //
  // Por eso ahora: (a) se acepta cualquiera de los dos nombres del sellado —el directo o el del
  // punto único—, y (b) los dos anclajes se exigen PRESENTES antes de comparar posiciones.
  const SELLADO_ANUL = ['sellarAnulacionTrasEmision', 'applyVeriFactuAnulacion'];
  const iSella = Math.min(...SELLADO_ANUL.map((n) => bloque.indexOf(n)).filter((i) => i >= 0), Infinity);
  const iGuarda = bloque.indexOf("'annulled'");

  assert.ok(
    Number.isFinite(iSella) && iGuarda >= 0,
    `🔴 ESCÁNER CIEGO: en la ruta de anulación no encuentro ${Number.isFinite(iSella) ? '' : 'la llamada de sellado'}` +
      `${Number.isFinite(iSella) || iGuarda >= 0 ? '' : ' ni '}${iGuarda >= 0 ? '' : 'la guarda de «ya anulada»'}. ` +
      'Sin los dos anclajes esta comprobación de orden no compara nada: pasaría en vacío. Si el ' +
      'sellado se ha renombrado otra vez, actualiza SELLADO_ANUL ANTES de fiarte del verde.',
  );
  assert.ok(
    iGuarda < iSella,
    '🔴 la comprobación de «ya anulada» debe ir ANTES de llamar al sellado, no después',
  );
});

// ── 3. El XML trae los DOS registros ─────────────────────────────────────────────────────

test('SCRUM-153 · el XML del ejercicio lleva el alta Y la anulación', async () => {
  const inv = factura();
  await applyVeriFactuAnulacion(inv, merchant.taxId, fakePrisma([inv]));

  const { xml } = await buildVerifactuRegistrosXml({ merchantId: 1, year: 2026 }, fakePrisma([inv]));

  assert.ok(
    /RegistroAlta/.test(xml),
    '🔴 el XML perdió el registro de ALTA al anular. La anulación no sustituye al alta: la baja ' +
      'solo tiene sentido si el alta que anula sigue estando.',
  );
  assert.ok(
    /RegistroAnulacion/.test(xml),
    '🔴 el XML no incluye el registro de ANULACIÓN, así que ante la AEAT la factura seguiría viva',
  );
  assert.ok(
    xml.indexOf('RegistroAlta') < xml.indexOf('RegistroAnulacion'),
    '🔴 la anulación va ANTES del alta en el XML. El orden es el de la cadena: no se puede dar ' +
      'de baja algo que en el mismo documento todavía no se ha dado de alta.',
  );
});

test('SCRUM-153 · sin anular, el XML trae solo el alta', async () => {
  const { xml } = await buildVerifactuRegistrosXml({ merchantId: 1, year: 2026 }, fakePrisma([factura()]));
  assert.ok(/RegistroAlta/.test(xml));
  assert.ok(
    !/RegistroAnulacion/.test(xml),
    '🔴 aparece un registro de anulación en una factura que nadie anuló — sería declarar una ' +
      'baja falsa ante la AEAT',
  );
});

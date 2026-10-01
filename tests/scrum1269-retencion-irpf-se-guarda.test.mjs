// tests/scrum1269-retencion-irpf-se-guarda.test.mjs — SCRUM-1269
//
// 🔴 LA RETENCIÓN DE IRPF DE CONFIGURACIÓN NO SE GUARDABA NUNCA.
//
// La pantalla manda `retencionIrpfDeclarada` y `retencionIrpfTipo`; el esquema del PUT
// (`merchantProfileUpdateSchema`) no los declaraba y `z.object` los DESCARTA en silencio.
// `updateMerchantProfile` escribe lo que sobrevive, así que las dos columnas no se escribían jamás:
// el profesional elegía «15 %», veía «guardado» y al recargar volvía «No consta».
//
// POR QUÉ NO LO VIO SCRUM-1227: su test llama a `updateMerchantProfile` DIRECTAMENTE y se salta el
// esquema — justo el eslabón donde se perdían. Aquí el viaje entra por donde entra el PUT
// (`app.ts`: `merchantProfileUpdateSchema.safeParse(req.body)` → `updateMerchantProfile(parsed.data)`)
// y vuelve por el GET, y se exige EL VALOR guardado, no que la clave exista. ⛔ Sin red ni base.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const moduloPrisma = await import('../dist/core/db/prisma.js');
const { merchantProfileUpdateSchema } = await import('../dist/core/validation/schemas.js');
const { getMerchantProfile, updateMerchantProfile } = await import('../dist/modules/system/merchantAdmin.js');
const { TIPOS_RETENCION } = await import('../dist/modules/invoicing/domain/retencionIrpf.js');

/** Las claves que Configuración manda al guardar, leídas de su `payload` (mismo lector que 1227). */
function clavesQueGuardaLaPantalla() {
  const sv = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/settingsView.js'), 'utf8');
  const i = sv.indexOf('const payload = {');
  assert.ok(i >= 0, '🔴 CIEGO: no encuentro el `payload` del guardado de Configuración');
  const cuerpo = sv.slice(i, sv.indexOf('\n      };', i));
  return [...cuerpo.matchAll(/^\s{8}(\w+):/gm)].map((m) => m[1]);
}

// Un guardado VÁLIDO de la pantalla, con valores distintos del valor por defecto de cada columna:
// un valor igual al de por defecto aprobaría aunque no se hubiera escrito nada.
const GUARDADO = {
  name: 'Fontanería QA', legalName: 'Fontanería QA SL', taxId: 'B00000000', address: 'C/ Mayor 1',
  criterioCaja: true,
  llevaLibrosPorSii: true, domicilioFiscalForal: false, // SCRUM-1102f
  whatsappPhone: '34000000027', // rango imposible (SCRUM-262)
  defaultCurrency: 'EUR', invoiceSeriesPrefix: 'CF',
  retencionIrpfDeclarada: true, retencionIrpfTipo: 15, logoUrl: null, googleReviewUrl: null,
  country: 'ES', iban: null, clabe: null, bizumPhone: null,
  notifyEmailOnPaid: true, notifyEmailOnQuoteAccepted: true, notifyEmailWeeklyDigest: true,
  homePrefs: { showTechPhotoToClient: true, bloqueCobros: false },
  brandColor: '#123456', approvalThreshold: 500,
  clausulasPresupuesto: [{ id: 'garantia', titulo: 'Garantía', texto: 'Seis meses sobre la mano de obra.' }],
};

/** Una base que empieza con los valores POR DEFECTO de las columnas y respeta el `select`. */
function baseQueRecuerda() {
  const fila = {
    id: 7, email: 'pro@example.invalid', timezone: null, flags: null,
    retencionIrpfDeclarada: false, retencionIrpfTipo: null, criterioCaja: null,
  };
  moduloPrisma.prisma.merchant = {
    findUnique: async ({ select }) => Object.fromEntries(
      Object.keys(select).filter((k) => select[k]).map((k) => [k, k in fila ? fila[k] : null]),
    ),
    update: async ({ data }) => Object.assign(fila, structuredClone(data)),
  };
  moduloPrisma.prisma.invoice = { findMany: async () => [] };
  return fila;
}

const originales = { merchant: moduloPrisma.prisma.merchant, invoice: moduloPrisma.prisma.invoice };
test.after(() => Object.assign(moduloPrisma.prisma, originales));

/** El PUT tal y como lo hace `app.ts`: esquema primero, y a la base solo lo que sobrevive. */
async function putComoApp(body) {
  const parsed = merchantProfileUpdateSchema.safeParse(structuredClone(body));
  if (!parsed.success) return { status: 400, error: parsed.error.flatten() };
  await updateMerchantProfile(7, parsed.data);
  return { status: 200 };
}

test('SCRUM-1269 · SUELO: el banco cubre todo lo que la pantalla guarda', () => {
  const claves = clavesQueGuardaLaPantalla();
  assert.ok(claves.length >= 20, `🔴 CIEGO: solo leo ${claves.length} claves del payload`);
  assert.deepEqual(claves.filter((k) => !(k in GUARDADO)), [],
    '🔴 la pantalla guarda campos que este test no prueba: añádelos a GUARDADO');
});

test('🔴 SCRUM-1269 · CENSO: el esquema del PUT no descarta NINGUNA clave que la pantalla manda', () => {
  const parsed = merchantProfileUpdateSchema.safeParse(structuredClone(GUARDADO));
  assert.ok(parsed.success, `el guardado de la pantalla no pasa el esquema: ${JSON.stringify(parsed.error?.flatten())}`);
  const descartadas = clavesQueGuardaLaPantalla().filter((k) => !(k in parsed.data));
  assert.deepEqual(descartadas, [],
    '🔴 el esquema del PUT DESCARTA en silencio estas claves: la pantalla las manda, dice «guardado» y no se escriben');
});

test('🔴 SCRUM-1269 · IDA Y VUELTA POR EL PUT: todo lo que la pantalla guarda vuelve CON SU VALOR', async () => {
  baseQueRecuerda();
  assert.equal((await putComoApp(GUARDADO)).status, 200);
  const p = await getMerchantProfile(7);
  const distintos = clavesQueGuardaLaPantalla()
    .filter((k) => k !== 'clausulasPresupuesto')
    .filter((k) => JSON.stringify(p[k]) !== JSON.stringify(GUARDADO[k]))
    .map((k) => `${k}: guardé ${JSON.stringify(GUARDADO[k])}, vuelve ${JSON.stringify(p[k])}`);
  assert.deepEqual(distintos, [], '🔴 estos campos no vuelven con lo que se guardó');
  assert.deepEqual(p.clausulasPresupuesto.map((c) => c.id), ['garantia']);
});

test('SCRUM-1269 · los TRES estados de la retención hacen el viaje y vuelven distintos', async () => {
  const casos = [
    { nombre: 'no consta', body: { retencionIrpfDeclarada: false, retencionIrpfTipo: null }, sale: [false, null] },
    { nombre: 'no retiene', body: { retencionIrpfDeclarada: true, retencionIrpfTipo: null }, sale: [true, null] },
    ...TIPOS_RETENCION.map((t) => ({ nombre: `retiene ${t} %`, body: { retencionIrpfDeclarada: true, retencionIrpfTipo: t }, sale: [true, t] })),
  ];
  for (const c of casos) {
    const fila = baseQueRecuerda();
    // Se parte del estado CONTRARIO, para que «vuelve igual» no apruebe sin haber escrito.
    fila.retencionIrpfDeclarada = !c.sale[0];
    fila.retencionIrpfTipo = c.sale[1] === 7 ? 15 : 7;
    assert.equal((await putComoApp(c.body)).status, 200, `${c.nombre}: rechazado`);
    const p = await getMerchantProfile(7);
    assert.deepEqual([p.retencionIrpfDeclarada, p.retencionIrpfTipo], c.sale, `🔴 ${c.nombre} no vuelve como se guardó`);
  }
});

test('SCRUM-1269 · lo incoherente o fuera del cubo se RECHAZA (400) y no toca la base', async () => {
  for (const body of [
    { retencionIrpfDeclarada: true, retencionIrpfTipo: 19 }, // no es un tipo de retención profesional
    { retencionIrpfDeclarada: true, retencionIrpfTipo: 15.5 },
    { retencionIrpfDeclarada: true, retencionIrpfTipo: '15' },
    { retencionIrpfDeclarada: false, retencionIrpfTipo: 15 }, // un tipo sin declarar
    { retencionIrpfTipo: 15 },
  ]) {
    const fila = baseQueRecuerda();
    const r = await putComoApp(body);
    assert.equal(r.status, 400, `🔴 aceptado: ${JSON.stringify(body)}`);
    assert.deepEqual([fila.retencionIrpfDeclarada, fila.retencionIrpfTipo], [false, null], 'un 400 no escribe');
  }
});

test('SCRUM-1269 · control: un guardado que NO trae la retención no la toca', async () => {
  const fila = baseQueRecuerda();
  fila.retencionIrpfDeclarada = true;
  fila.retencionIrpfTipo = 7;
  assert.equal((await putComoApp({ name: 'Otro nombre' })).status, 200);
  assert.deepEqual([fila.retencionIrpfDeclarada, fila.retencionIrpfTipo], [true, 7]);
});

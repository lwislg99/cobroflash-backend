// docs/master/evidencias/SCRUM-1779/vias-banco.mjs — SCRUM-1779a, puntos 1, 3 y 5 (SOLO LECTURA)
//
// PREGUNTA: con un comercio ES con INVOICING_ES_ENABLED=ON (override por merchant) y SIF_ENABLED=OFF
// (default; sin variable de entorno), ¿qué emite HOY el `dist/` compilado?
//
// BANCO: `tests/_banco-emision-con-estado.mjs` (el de SCRUM-1304/1330/1333). Dobla la BASE, el PDF y
// el correo y nada más; lo que corre encima es `dist/` tal cual. NO es Postgres (no hay ninguno en
// esta máquina ni PGlite instalado): no deshace transacciones, no aísla, ignora `select`.
//
// Qué se ejecuta por vía: el NÚCLEO que la ruta llama (allocateInvoiceNumber real con su camino,
// crearFacturaEmitida real, sellarTrasEmision real → applyVeriFactu + encolarAltaTrasSellado), con el
// mismo `type`/`status` que la ruta escribe (leído en el fuente). El handler HTTP sólo se ejecuta para
// la vía 5 (documento suelto); las otras rutas: su portón previo se ejecuta con la misma función que
// llaman (getEmissionMode / modoDocumentoSuelto / motivoSiiSinEmision), el resto está LEÍDO.
//
// No escribe nada fuera de memoria. No toca red (WHATSAPP_DRY_RUN=1 lo pone el banco; no se llama a
// sendInvoicePaymentRequest, que haría un fetch a /charges).
delete process.env.SIF_ENABLED;
delete process.env.INVOICING_ES_ENABLED;

import {
  banco, prisma, reiniciar as reiniciarBanco, requiere, rutaDe, asentar, M_ES, CLIENTE,
} from '../../../../tests/_banco-emision-con-estado.mjs';

const salida = [];
const di = (...x) => { const l = x.join(' '); salida.push(l); process.stdout.write(l + '\n'); };
let fallos = 0;
const comprueba = (ok, texto) => { if (!ok) fallos++; di(`${ok ? 'OK  ' : 'FALLO'} ${texto}`); };

// Silenciar la consola del dist (los avisos se cuentan aparte).
const voces = { log: console.log, warn: console.warn, error: console.error };
const avisos = [];
console.log = () => {}; console.warn = (...a) => avisos.push(a.map(String).join(' ')); console.error = (...a) => avisos.push(a.map(String).join(' '));

const { isFlagEnabled } = requiere(rutaDe('dist/core/flags.js'));
const { getEmissionMode, motivoSiiSinEmision } = requiere(rutaDe('dist/modules/invoicing/domain/emission.service.js'));
const { allocateInvoiceNumber } = requiere(rutaDe('dist/modules/invoicing/domain/invoiceNumber.service.js'));
const { crearFacturaEmitida } = requiere(rutaDe('dist/modules/invoicing/domain/crearFacturaEmitida.js'));
const { congelarCliente } = requiere(rutaDe('dist/modules/invoicing/domain/clienteCongelado.js'));
const { congelarEmisorDesdeFicha } = requiere(rutaDe('dist/modules/invoicing/domain/emisorCongelado.js'));
const { sellarTrasEmision } = requiere(rutaDe('dist/modules/invoicing/domain/selladoEstado.js'));
const { modoDocumentoSuelto } = requiere(rutaDe('dist/modules/invoicing/domain/facturaSuelta.js'));
const { procesarObligado } = requiere(rutaDe('dist/modules/fiscal/verifactu/sif.procesador.js'));
const { reintentarSelladosPendientes, fechaDeCorte } = requiere(rutaDe('dist/modules/invoicing/domain/reintentoSellado.js'));
const invoicesAdmin = requiere(rutaDe('dist/modules/system/app/routes/invoicesAdmin.routes.js'));

const NIF = 'B27000001';
const LINEAS = [{ concept: 'Arreglo de una fuga', qty: 1, price: 100, tax: 0.21 }];

function reiniciar({ flags = { INVOICING_ES_ENABLED: true }, sii = false, taxId = NIF } = {}) {
  reiniciarBanco();
  const m = banco.tablas.merchant.find((x) => x.id === M_ES);
  Object.assign(m, { flags, llevaLibrosPorSii: sii, taxId, defaultCurrency: 'EUR' });
  Object.assign(banco.tablas.customer[0], { merchantId: M_ES, taxId: '12345678Z', legalName: 'Clienta de prueba SL', address: 'Calle 1, Lugo', tipoDestinatario: null });
  return m;
}
const merchant = () => banco.tablas.merchant.find((x) => x.id === M_ES);
const cuenta = () => ({ invoice: banco.tablas.invoice.length, vfSubmission: banco.tablas.vfSubmission.length, charge: banco.tablas.charge.length });

/** El núcleo que cada ruta llama, con el camino y los datos que ella escribe. */
async function nucleo({ camino, rectifying = false, type = 'F1', status, rectifiesId = null, total = '121.00', lines = LINEAS }) {
  const m = merchant();
  const cliente = await congelarCliente(prisma, M_ES, CLIENTE);
  const emisor = congelarEmisorDesdeFicha(m);
  const inv = await prisma.$transaction(async (tx) => {
    const number = await allocateInvoiceNumber(tx, M_ES, { camino, rectifying, actor: { tipo: 'propietario' } });
    return crearFacturaEmitida(tx, cliente, emisor, {
      merchantId: M_ES, customerId: CLIENTE, quoteId: null, number, type, total, currency: 'EUR', lines,
      ...(status ? { status } : {}), ...(rectifiesId ? { rectifiesId } : {}),
      pdfUrl: 'PENDING_PDF', qrData: 'PENDING_QR', registerId: null,
    });
  });
  const sello = await sellarTrasEmision(inv, m, prisma);
  await asentar();
  return { inv: banco.tablas.invoice.find((f) => f.id === inv.id), sello };
}

const resumenFactura = (f) => ({
  numero: f.number, tipo: f.type, status: f.status, vfEstado: f.vfEstado, huella: f.vfHash ? `sí (${f.vfHash.slice(0, 12)}…)` : 'no',
  prevHash: f.vfPrevHash ? `${f.vfPrevHash.slice(0, 12)}…` : String(f.vfPrevHash), qr: String(f.qrData).slice(0, 40), chargeId: f.chargeId,
});
const resumenCola = () => banco.tablas.vfSubmission.map((s) => ({
  invoiceId: s.invoiceId, status: s.status ?? '(default de esquema: pending)', tipoOperacion: s.tipoOperacion, obligadoNif: s.obligadoNif,
  xml: typeof s.registroXml === 'string' ? `${s.registroXml.length} B, empieza «${s.registroXml.slice(0, 30).replace(/\s+/g, ' ')}»` : String(s.registroXml),
}));

// ═══ CONTROL CERO ════════════════════════════════════════════════════════════════════════════
di('═══ CONTROL CERO: banco recién reiniciado, sin llamar a nada');
reiniciar();
comprueba(JSON.stringify(cuenta()) === '{"invoice":0,"vfSubmission":0,"charge":0}', `tablas vacías ${JSON.stringify(cuenta())}`);

// ═══ FLAGS QUE VE EL CÓDIGO ═════════════════════════════════════════════════════════════════
di('\n═══ FLAGS (precedencia merchant > país > env > default, src/core/flags.ts:68-90)');
reiniciar();
const mOn = merchant();
di(`  env SIF_ENABLED=${process.env.SIF_ENABLED ?? '(sin definir)'} · env INVOICING_ES_ENABLED=${process.env.INVOICING_ES_ENABLED ?? '(sin definir)'}`);
di(`  merchant.flags=${JSON.stringify(mOn.flags)} · llevaLibrosPorSii=${mOn.llevaLibrosPorSii} · taxId=${mOn.taxId} · country=${mOn.country}`);
comprueba(isFlagEnabled('INVOICING_ES_ENABLED', { merchant: mOn }) === true, 'INVOICING_ES_ENABLED del merchant = true');
comprueba(isFlagEnabled('SIF_ENABLED', { merchant: mOn }) === false, 'SIF_ENABLED del merchant = false');
comprueba(isFlagEnabled('SIF_ENABLED') === false, 'SIF_ENABLED global (lo que lee el procesador de la cola) = false');
comprueba(getEmissionMode(mOn) === 'fiscal', `getEmissionMode = ${getEmissionMode(mOn)}`);

// ═══ PUNTO 1: LAS SEIS VÍAS ════════════════════════════════════════════════════════════════
di('\n═══ PUNTO 1 · las vías 1-6 de SCRUM-1097, flag ON + SII «No» + SIF OFF');
const portones = {
  'C1 quotes.routes.ts:568 (getEmissionMode !== receipt)': getEmissionMode(mOn) !== 'receipt',
  'C2 jobs.routes.ts:1528 (getEmissionMode === receipt → 409)': getEmissionMode(mOn) !== 'receipt',
  'C3 quotesAdmin.routes.ts:259 (getEmissionMode === receipt → 409)': getEmissionMode(mOn) !== 'receipt',
  'C4 quotesAdmin.routes.ts:582 (getEmissionMode === receipt → 409)': getEmissionMode(mOn) !== 'receipt',
  'C7-suelta invoicesAdmin.routes.ts:143 (modoDocumentoSuelto)': modoDocumentoSuelto(mOn) === 'factura',
  'C5 R1 invoicesAdmin (motivoSiiSinEmision null)': motivoSiiSinEmision(mOn) === null,
};
for (const [k, v] of Object.entries(portones)) di(`  portón previo ${k}: ${v ? 'PASA' : 'CORTA'}`);

const vias = [
  { n: 1, nombre: 'C1 aceptar presupuesto (cliente final)', camino: 'C1' },
  { n: 2, nombre: 'C2 collect-rest', camino: 'C2' },
  { n: 3, nombre: 'C3 quotesAdmin /:id/invoice', camino: 'C3' },
  { n: 4, nombre: 'C4 quotesAdmin /:id/invoice-manual', camino: 'C4' },
];
reiniciar();
const resultadosVias = [];
for (const v of vias) {
  const antes = cuenta();
  const { inv, sello } = await nucleo({ camino: v.camino });
  resultadosVias.push({ via: v.n, ...resumenFactura(inv), sello: sello.estado });
  di(`  vía ${v.n} ${v.nombre}: ${JSON.stringify(resumenFactura(inv))} · sellarTrasEmision → ${sello.estado} · Δfilas ${JSON.stringify({ invoice: cuenta().invoice - antes.invoice, vfSubmission: cuenta().vfSubmission - antes.vfSubmission, charge: cuenta().charge - antes.charge })}`);
}

// Vía 5: el HANDLER real de invoicesAdmin POST / (sin el montaje: es el handler, no la ruta — A10 SCRUM-1344).
const capaSuelta = (invoicesAdmin.default || invoicesAdmin).stack.find((l) => l.route?.path === '/' && l.route.methods.post);
const hSuelta = capaSuelta.route.stack.at(-1).handle;
async function llamar(h, req) {
  const r = { statusCode: 200, cuerpo: null };
  const res = { status(c) { r.statusCode = c; return res; }, json(x) { r.cuerpo = x; return res; }, setHeader() {}, set() { return res; } };
  await h(req, res, (e) => { if (e) throw e; });
  await asentar();
  return r;
}
{
  const antes = cuenta();
  const r = await llamar(hSuelta, { merchantId: M_ES, teamMemberId: null, role: 'admin', body: { customerId: CLIENTE, lines: LINEAS } });
  const f = banco.tablas.invoice.find((x) => x.id === r.cuerpo?.id) ?? banco.tablas.invoice.at(-1);
  di(`  vía 5 C7-suelta invoicesAdmin POST / (HANDLER ejecutado): HTTP ${r.statusCode} ${JSON.stringify(r.cuerpo)}`);
  di(`        fila: ${f ? JSON.stringify(resumenFactura(f)) : '(ninguna)'} · Δfilas ${JSON.stringify({ invoice: cuenta().invoice - antes.invoice, vfSubmission: cuenta().vfSubmission - antes.vfSubmission, charge: cuenta().charge - antes.charge })}`);
  if (f) resultadosVias.push({ via: 5, ...resumenFactura(f), http: r.statusCode });
}

// Vía 6: R1 sobre la factura de la vía 3 (núcleo con rectifying, type R1, status 'paid' como invoicesAdmin.routes.ts:1226).
{
  const original = banco.tablas.invoice.find((f) => f.number === resultadosVias[2].numero);
  const antes = cuenta();
  const { inv, sello } = await nucleo({ camino: 'C5', rectifying: true, type: 'R1', status: 'paid', rectifiesId: original.id, total: '-121.00', lines: [{ ...LINEAS[0], qty: -1 }] });
  resultadosVias.push({ via: 6, ...resumenFactura(inv), sello: sello.estado });
  di(`  vía 6 C5 R1 de ${original.number}: ${JSON.stringify(resumenFactura(inv))} · sellarTrasEmision → ${sello.estado} · Δfilas ${JSON.stringify({ invoice: cuenta().invoice - antes.invoice, vfSubmission: cuenta().vfSubmission - antes.vfSubmission, charge: cuenta().charge - antes.charge })}`);
}

// Contadores y auditoría que quedan
const mFin = merchant();
di(`  contadores del merchant: nextInvoiceNumber=${mFin.nextInvoiceNumber} nextRectInvoiceNumber=${mFin.nextRectInvoiceNumber} invoiceSeriesYear=${mFin.invoiceSeriesYear}`);
const auds = banco.tablas.auditLog.map((a) => `${a.action}${a.meta?.payload?.camino ? `[${a.meta.payload.camino}/${a.meta.payload.tipoFactura}; flags ${JSON.stringify(a.meta.flagsFiscales ?? a.meta?.contexto?.flagsFiscales ?? '?')}]` : ''}`);
di(`  auditLog (${auds.length}): ${auds.join(' · ')}`);
di(`  ajenas (modelos no gobernados por el banco): ${[...new Set(banco.ajenas)].join(', ') || '(ninguna)'}`);
comprueba(banco.tablas.charge.length === 0, `filas charge creadas por las vías 1-6 en el banco: ${banco.tablas.charge.length}`);

// ═══ PUNTO 3: HUELLA, XML, COLA ════════════════════════════════════════════════════════════
di('\n═══ PUNTO 3 · huella / XML / cola con SIF_ENABLED OFF');
const cola = resumenCola();
di(`  vfSubmission: ${cola.length} filas`);
for (const c of cola) di(`    ${JSON.stringify(c)}`);
const conHuella = banco.tablas.invoice.filter((f) => f.vfHash).length;
comprueba(conHuella === banco.tablas.invoice.length, `facturas con huella: ${conHuella}/${banco.tablas.invoice.length}`);
const encadenadas = banco.tablas.invoice.slice(1).every((f, i) => f.vfPrevHash === banco.tablas.invoice[i].vfHash);
di(`  cadena: cada vfPrevHash = vfHash de la anterior → ${encadenadas}; la primera vfPrevHash=${banco.tablas.invoice[0].vfPrevHash}`);
const proc = await procesarObligado(NIF, async () => { throw new Error('NO DEBERÍA ENVIAR'); }, { prisma });
di(`  procesarObligado(NIF) con SIF_ENABLED global OFF → ${JSON.stringify(proc)}`);
comprueba(proc.hecho === 'pausada', 'la cola se queda en pausa');
const statusCola = banco.tablas.vfSubmission.map((s) => s.status ?? 'pending(default)');
di(`  estado de la cola después del procesador: ${statusCola.join(', ')}`);

// ═══ CONTROL POSITIVO 1: el MISMO comercio con el flag OFF ═══════════════════════════════════
di('\n═══ CONTROL POSITIVO 1 · mismo comercio con flags {INVOICING_ES_ENABLED:false}');
reiniciar({ flags: { INVOICING_ES_ENABLED: false } });
di(`  getEmissionMode = ${getEmissionMode(merchant())} · modoDocumentoSuelto = ${modoDocumentoSuelto(merchant())}`);
let errOff = null;
try { await nucleo({ camino: 'C3' }); } catch (e) { errOff = e.message; }
comprueba(errOff === 'invoicing_es_disabled', `allocateInvoiceNumber lanza «${errOff}»`);
const rOff = await llamar(hSuelta, { merchantId: M_ES, teamMemberId: null, role: 'admin', body: { customerId: CLIENTE, lines: LINEAS } });
comprueba(rOff.statusCode === 409, `handler suelta → HTTP ${rOff.statusCode} ${JSON.stringify(rOff.cuerpo)}`);
comprueba(cuenta().invoice === 0 && cuenta().vfSubmission === 0, `filas tras el atajo: ${JSON.stringify(cuenta())}; contador nextInvoiceNumber=${merchant().nextInvoiceNumber}`);

// CONTROL POSITIVO 2: flag ON pero SII «No consta» (null) → receipt, para ver que el banco ve el SII
di('\n═══ CONTROL POSITIVO 2 · flag ON, llevaLibrosPorSii=null («No consta»)');
reiniciar({ sii: null });
let errSii = null;
try { await nucleo({ camino: 'C3' }); } catch (e) { errSii = e.message; }
comprueba(errSii === 'sii_no_consta', `allocateInvoiceNumber lanza «${errSii}»; filas ${JSON.stringify(cuenta())}`);

// CONTROL POSITIVO 3: el procesador SÍ distingue SIF ON (se le pasa sifEnabled:true y un enviar que no envía)
di('\n═══ CONTROL POSITIVO 3 · procesador con sifEnabled:true (enviar doblado, sin red)');
reiniciar();
await nucleo({ camino: 'C3' });
// La fila no trae `nextAttemptAt` (lo pondría el default de Postgres, null); el banco no aplica defaults.
for (const s of banco.tablas.vfSubmission) { s.nextAttemptAt ??= null; s.status ??= 'pending'; s.attempts ??= 0; }
let llamadasEnviar = 0;
let proc3;
try {
  proc3 = await procesarObligado(NIF, async () => { llamadasEnviar++; return { tipo: 'error_transporte', mensaje: 'doblado' }; }, { prisma, sifEnabled: true });
} catch (e) { proc3 = { lanzó: e.message.slice(0, 120) }; }
di(`  resultado ${JSON.stringify(proc3)} · llamadas a enviar=${llamadasEnviar}`);
comprueba(llamadasEnviar >= 1 || (proc3 && proc3.hecho !== 'pausada'), 'con SIF ON el procesador NO se queda en pausa (el banco ve la diferencia)');

// ═══ PUNTO 5: REGLA 29 — ¿se puede sellar DESPUÉS una factura emitida sin huella? ═══════════
di('\n═══ PUNTO 5 · sellado posterior de una factura emitida sin huella');
// 5a: merchant ES SIN NIF → la factura nace y queda `no_aplica`, sin huella.
reiniciar({ taxId: null });
const a = await nucleo({ camino: 'C3' });
di(`  5a emitida con merchant sin NIF: ${JSON.stringify(resumenFactura(a.inv))} · sello=${a.sello.estado}`);
// Se le pone NIF al merchant y se vuelve a pasar la MISMA fila por sellarTrasEmision.
merchant().taxId = NIF;
const s2 = await sellarTrasEmision(a.inv, merchant(), prisma);
await asentar();
const a2 = banco.tablas.invoice.find((f) => f.id === a.inv.id);
di(`  5a después (NIF puesto, sellarTrasEmision sobre la misma fila): sello=${s2.estado} · ${JSON.stringify(resumenFactura(a2))} · createdAt=${a2.createdAt.toISOString()} vfTimestamp=${a2.vfTimestamp?.toISOString?.()} · cola=${banco.tablas.vfSubmission.length}`);
di(`     emisor congelado en la fila: merchantTaxId=${a2.merchantTaxId ?? '(null)'} · auditLog: ${banco.tablas.auditLog.map((x) => `${x.action}${x.meta?.motivo ? `(${x.meta.motivo})` : ''}${x.meta?.errorMensaje ? `(${String(x.meta.errorMensaje).slice(0, 80)})` : ''}`).join(' · ')}`);
// 5b: factura pendiente (sellado fallido simulado dejando la fila tal como nace) y el reintento del cron.
reiniciar();
const m5 = merchant();
const cliente = await congelarCliente(prisma, M_ES, CLIENTE);
const pend = await prisma.$transaction(async (tx) => {
  const number = await allocateInvoiceNumber(tx, M_ES, { camino: 'C3', actor: { tipo: 'propietario' } });
  return crearFacturaEmitida(tx, cliente, congelarEmisorDesdeFicha(m5), { merchantId: M_ES, customerId: CLIENTE, quoteId: null, number, type: 'F1', total: '121.00', currency: 'EUR', lines: LINEAS, pdfUrl: 'PENDING_PDF', qrData: 'PENDING_QR', registerId: null });
});
await asentar();
const filaPend = banco.tablas.invoice.find((f) => f.id === pend.id);
di(`  5b emitida sin sellar (proceso «muere» antes de sellarTrasEmision): ${JSON.stringify(resumenFactura(filaPend))}`);
di(`  fechaDeCorte() = ${JSON.stringify(fechaDeCorte())}`);
// El evaluador del banco no sabe `createdAt: { gte }`: un envoltorio SÓLO en este script lo quita del
// `where` y filtra después por la misma condición. El reintento real (dist) corre intacto encima.
const prismaConGte = new Proxy(prisma, {
  get(t, p) {
    const v = t[p];
    if (p !== 'invoice') return v;
    return new Proxy(v, { get(m, op) {
      if (op !== 'findMany') return m[op];
      return async (args = {}) => {
        const { createdAt, ...resto } = args.where ?? {};
        const filas = await m.findMany({ ...args, where: resto });
        const conM = args.select?.merchant ? filas.map((f) => ({ ...f, merchant: banco.tablas.merchant.find((x) => x.id === f.merchantId) ?? null })) : filas; // el banco sólo resuelve relaciones de `charge`
        return createdAt?.gte ? conM.filter((f) => f.createdAt.getTime() >= new Date(createdAt.gte).getTime()) : conM;
      };
    } });
  },
});
let parte;
try { parte = await reintentarSelladosPendientes({ prisma: prismaConGte, ahora: new Date(Date.now() + 3600e3) }); } catch (e) { parte = { lanzó: e.message.slice(0, 160) }; }
await asentar();
const filaPend2 = banco.tablas.invoice.find((f) => f.id === pend.id);
di(`  reintentarSelladosPendientes({prisma, ahora: +1 h}) → ${JSON.stringify(parte).slice(0, 400)}`);
di(`  5b después del reintento: ${JSON.stringify(resumenFactura(filaPend2))} · cola=${banco.tablas.vfSubmission.length}`);
// 5c: control: una factura YA sellada que vuelve a pasar no cambia de huella (guarda B de SCRUM-1330)
const h1 = filaPend2.vfHash;
await sellarTrasEmision(filaPend2, merchant(), prisma);
await asentar();
comprueba(banco.tablas.invoice.find((f) => f.id === pend.id).vfHash === h1, `5c re-sellar una sellada no cambia la huella (${String(h1).slice(0, 12)}…) · cola=${banco.tablas.vfSubmission.length}`);

Object.assign(console, voces);
di(`\nAVISOS del dist (${avisos.length}, primeros 120 car. de cada uno):`);
for (const x of [...new Set(avisos)]) di(`  · ${x.slice(0, 120)}`);
di(`\nRESULTADO: ${fallos === 0 ? 'todas las comprobaciones OK' : `${fallos} comprobación(es) en FALLO`}`);
process.exitCode = fallos === 0 ? 0 : 1;
